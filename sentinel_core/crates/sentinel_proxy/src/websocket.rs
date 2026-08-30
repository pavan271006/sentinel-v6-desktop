//! RFC 6455 WebSocket Framing & Bidirectional Tapping

use std::sync::Arc;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tracing::{debug, warn};

pub use crate::pipeline::interceptor::{RequestContext, WsFrame};
use crate::pipeline::InterceptorPipeline;

pub const WS_OPCODE_CONTINUATION: u8 = 0x0;
pub const WS_OPCODE_TEXT: u8 = 0x1;
pub const WS_OPCODE_BINARY: u8 = 0x2;
pub const WS_OPCODE_CLOSE: u8 = 0x8;
pub const WS_OPCODE_PING: u8 = 0x9;
pub const WS_OPCODE_PONG: u8 = 0xA;

/// Reads and decodes a single RFC 6455 WebSocket frame from an async reader.
pub async fn read_ws_frame<R: AsyncRead + Unpin>(
    reader: &mut R,
    from_client: bool,
) -> Result<Option<WsFrame>, std::io::Error> {
    let mut header = [0u8; 2];
    if let Err(e) = reader.read_exact(&mut header).await {
        if e.kind() == std::io::ErrorKind::UnexpectedEof {
            return Ok(None);
        }
        return Err(e);
    }

    let is_final = (header[0] & 0x80) != 0;
    let opcode = header[0] & 0x0F;
    let is_masked = (header[1] & 0x80) != 0;
    let mut payload_len = (header[1] & 0x7F) as usize;

    if payload_len == 126 {
        let mut ext = [0u8; 2];
        reader.read_exact(&mut ext).await?;
        payload_len = u16::from_be_bytes(ext) as usize;
    } else if payload_len == 127 {
        let mut ext = [0u8; 8];
        reader.read_exact(&mut ext).await?;
        payload_len = u64::from_be_bytes(ext) as usize;
    }

    let mask_key = if is_masked {
        let mut mask = [0u8; 4];
        reader.read_exact(&mut mask).await?;
        Some(mask)
    } else {
        None
    };

    let mut payload = vec![0u8; payload_len];
    reader.read_exact(&mut payload).await?;

    if let Some(mask) = mask_key {
        for (i, byte) in payload.iter_mut().enumerate() {
            *byte ^= mask[i % 4];
        }
    }

    Ok(Some(WsFrame {
        opcode,
        payload,
        is_final,
        from_client,
    }))
}

/// Encodes and writes an RFC 6455 WebSocket frame to an async writer.
pub async fn write_ws_frame<W: AsyncWrite + Unpin>(
    writer: &mut W,
    frame: &WsFrame,
    mask: bool,
) -> Result<(), std::io::Error> {
    let mut header = Vec::with_capacity(14 + frame.payload.len());
    let b0 = if frame.is_final { 0x80 } else { 0x00 } | (frame.opcode & 0x0F);
    header.push(b0);

    let mask_bit = if mask { 0x80 } else { 0x00 };
    let len = frame.payload.len();

    if len < 126 {
        header.push(mask_bit | (len as u8));
    } else if len <= 0xFFFF {
        header.push(mask_bit | 126);
        header.extend_from_slice(&(len as u16).to_be_bytes());
    } else {
        header.push(mask_bit | 127);
        header.extend_from_slice(&(len as u64).to_be_bytes());
    }

    if mask {
        let mask_key = [0x12, 0x34, 0x56, 0x78];
        header.extend_from_slice(&mask_key);
        let mut masked_payload = frame.payload.clone();
        for (i, byte) in masked_payload.iter_mut().enumerate() {
            *byte ^= mask_key[i % 4];
        }
        header.extend_from_slice(&masked_payload);
    } else {
        header.extend_from_slice(&frame.payload);
    }

    writer.write_all(&header).await?;
    writer.flush().await?;
    Ok(())
}

/// Taps a bidirectional WebSocket stream and coordinates frame forwarding and interception.
pub async fn tap_websocket<CR, CW, SR, SW>(
    mut client_read: CR,
    mut client_write: CW,
    mut server_read: SR,
    mut server_write: SW,
    pipeline: Arc<InterceptorPipeline>,
    ctx: RequestContext,
) where
    CR: AsyncRead + Unpin + Send + 'static,
    CW: AsyncWrite + Unpin + Send + 'static,
    SR: AsyncRead + Unpin + Send + 'static,
    SW: AsyncWrite + Unpin + Send + 'static,
{
    let pipeline_c2s = pipeline.clone();
    let ctx_c2s = ctx.clone();

    // Task 1: Client to Server forwarding
    let c2s = tokio::spawn(async move {
        while let Ok(Some(mut frame)) = read_ws_frame(&mut client_read, true).await {
            let is_close = frame.opcode == WS_OPCODE_CLOSE;
            if let Ok(crate::pipeline::interceptor::InterceptAction::Drop { .. }) =
                pipeline_c2s.execute_on_ws_frame(&mut frame, &ctx_c2s).await
            {
                debug!("WebSocket frame dropped by interceptor");
                continue;
            }
            if let Err(e) = write_ws_frame(&mut server_write, &frame, false).await {
                warn!("Error forwarding WS frame to server: {}", e);
                break;
            }
            if is_close {
                break;
            }
        }
    });

    // Task 2: Server to Client forwarding
    let s2c = tokio::spawn(async move {
        while let Ok(Some(mut frame)) = read_ws_frame(&mut server_read, false).await {
            let is_close = frame.opcode == WS_OPCODE_CLOSE;
            if let Ok(crate::pipeline::interceptor::InterceptAction::Drop { .. }) =
                pipeline.execute_on_ws_frame(&mut frame, &ctx).await
            {
                debug!("WebSocket frame dropped by interceptor");
                continue;
            }
            if let Err(e) = write_ws_frame(&mut client_write, &frame, false).await {
                warn!("Error forwarding WS frame to client: {}", e);
                break;
            }
            if is_close {
                break;
            }
        }
    });

    let _ = tokio::join!(c2s, s2c);
}
