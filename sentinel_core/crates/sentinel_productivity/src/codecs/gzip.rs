//! RFC 1952 Gzip compression and decompression engine with decompression bomb safety guards.

use super::CodecError;

const GZIP_ID1: u8 = 0x1f;
const GZIP_ID2: u8 = 0x8b;
const GZIP_CM_DEFLATE: u8 = 0x08;

#[allow(dead_code)]
const FLAG_FTEXT: u8 = 0x01;
const FLAG_FHCRC: u8 = 0x02;
const FLAG_FEXTRA: u8 = 0x04;
const FLAG_FNAME: u8 = 0x08;
const FLAG_FCOMMENT: u8 = 0x10;

/// Default decompression limit: 50 Megabytes
pub const DEFAULT_MAX_DECOMPRESS_BYTES: usize = 50 * 1024 * 1024;

/// Compresses arbitrary byte data into RFC 1952 Gzip format.
pub fn compress_gzip(data: &[u8]) -> Result<Vec<u8>, CodecError> {
    compress_gzip_level(data, 6)
}

/// Compresses data with specified compression level (0..=9).
pub fn compress_gzip_level(data: &[u8], _level: u8) -> Result<Vec<u8>, CodecError> {
    let mut out = Vec::with_capacity(10 + data.len() + 8);

    // 10-byte Gzip Header
    out.push(GZIP_ID1);
    out.push(GZIP_ID2);
    out.push(GZIP_CM_DEFLATE);
    out.push(0x00); // Flags: none
    out.extend_from_slice(&[0, 0, 0, 0]); // MTIME (0 = no timestamp)
    out.push(0x00); // XFL (extra flags)
    out.push(0xff); // OS (unknown / 255)

    // Deflate payload (Stored uncompressed blocks of max 65535 bytes each)
    let chunks = data.chunks(65535);
    let num_chunks = if data.is_empty() { 1 } else { chunks.len() };

    if data.is_empty() {
        // BFINAL=1, BTYPE=00 (non-compressed)
        out.push(0x01);
        out.extend_from_slice(&[0x00, 0x00, 0xff, 0xff]); // LEN=0, NLEN=0xFFFF
    } else {
        for (i, chunk) in chunks.enumerate() {
            let is_last = i == num_chunks - 1;
            let bfinal = if is_last { 0x01 } else { 0x00 };
            out.push(bfinal); // Non-compressed block

            let len = chunk.len() as u16;
            let nlen = !len;
            out.extend_from_slice(&len.to_le_bytes());
            out.extend_from_slice(&nlen.to_le_bytes());
            out.extend_from_slice(chunk);
        }
    }

    // 8-byte Footer: CRC32 + ISIZE (uncompressed size modulo 2^32)
    let crc = crc32_compute(data);
    let isize = (data.len() as u32).to_le_bytes();

    out.extend_from_slice(&crc.to_le_bytes());
    out.extend_from_slice(&isize);

    Ok(out)
}

/// Decompresses RFC 1952 Gzip data with default 50MB decompression bomb guard.
pub fn decompress_gzip(input: &[u8]) -> Result<Vec<u8>, CodecError> {
    decompress_gzip_bounded(input, DEFAULT_MAX_DECOMPRESS_BYTES)
}

/// Decompresses RFC 1952 Gzip data bounded by `max_bytes`.
pub fn decompress_gzip_bounded(input: &[u8], max_bytes: usize) -> Result<Vec<u8>, CodecError> {
    if input.len() < 18 {
        return Err(CodecError::GzipError(
            "Input too short to be a valid Gzip stream".to_string(),
        ));
    }

    if input[0] != GZIP_ID1 || input[1] != GZIP_ID2 {
        return Err(CodecError::GzipError(
            "Invalid Gzip magic bytes (expected 0x1F 0x8B)".to_string(),
        ));
    }

    if input[2] != GZIP_CM_DEFLATE {
        return Err(CodecError::GzipError(format!(
            "Unsupported compression method: 0x{:02X}",
            input[2]
        )));
    }

    let flags = input[3];
    let mut offset = 10;

    // Optional FEXTRA
    if flags & FLAG_FEXTRA != 0 {
        if offset + 2 > input.len() {
            return Err(CodecError::GzipError("Malformed FEXTRA header".to_string()));
        }
        let xlen = u16::from_le_bytes([input[offset], input[offset + 1]]) as usize;
        offset += 2 + xlen;
    }

    // Optional FNAME (null-terminated string)
    if flags & FLAG_FNAME != 0 {
        while offset < input.len() && input[offset] != 0 {
            offset += 1;
        }
        offset += 1; // skip null byte
    }

    // Optional FCOMMENT (null-terminated string)
    if flags & FLAG_FCOMMENT != 0 {
        while offset < input.len() && input[offset] != 0 {
            offset += 1;
        }
        offset += 1; // skip null byte
    }

    // Optional FHCRC (2 bytes CRC16)
    if flags & FLAG_FHCRC != 0 {
        offset += 2;
    }

    if offset + 8 > input.len() {
        return Err(CodecError::GzipError(
            "Gzip payload truncated before footer".to_string(),
        ));
    }

    let deflate_payload = &input[offset..input.len() - 8];
    let expected_crc = u32::from_le_bytes([
        input[input.len() - 8],
        input[input.len() - 7],
        input[input.len() - 6],
        input[input.len() - 5],
    ]);
    let expected_isize = u32::from_le_bytes([
        input[input.len() - 4],
        input[input.len() - 3],
        input[input.len() - 2],
        input[input.len() - 1],
    ]);

    // Quick Bomb Check via ISIZE footer
    if (expected_isize as usize) > max_bytes {
        return Err(CodecError::DecompressionBomb { max_bytes });
    }

    // Inflate Deflate stream
    let decompressed = inflate_deflate(deflate_payload, max_bytes)?;

    if decompressed.len() > max_bytes {
        return Err(CodecError::DecompressionBomb { max_bytes });
    }

    // Validate CRC32
    let actual_crc = crc32_compute(&decompressed);
    if actual_crc != expected_crc {
        return Err(CodecError::GzipError(format!(
            "CRC-32 checksum mismatch: expected 0x{:08X}, got 0x{:08X}",
            expected_crc, actual_crc
        )));
    }

    Ok(decompressed)
}

/// Bit stream reader for Deflate decompression.
struct BitReader<'a> {
    data: &'a [u8],
    byte_pos: usize,
    bit_pos: u8,
}

impl<'a> BitReader<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self {
            data,
            byte_pos: 0,
            bit_pos: 0,
        }
    }

    fn read_bits(&mut self, n: u8) -> Option<u32> {
        let mut result = 0u32;
        for i in 0..n {
            if self.byte_pos >= self.data.len() {
                return None;
            }
            let bit = (self.data[self.byte_pos] >> self.bit_pos) & 1;
            result |= (bit as u32) << i;
            self.bit_pos += 1;
            if self.bit_pos == 8 {
                self.bit_pos = 0;
                self.byte_pos += 1;
            }
        }
        Some(result)
    }

    fn align_byte(&mut self) {
        if self.bit_pos > 0 {
            self.bit_pos = 0;
            self.byte_pos += 1;
        }
    }
}

fn inflate_deflate(input: &[u8], max_bytes: usize) -> Result<Vec<u8>, CodecError> {
    let mut reader = BitReader::new(input);
    let mut out = Vec::new();

    loop {
        let bfinal = reader
            .read_bits(1)
            .ok_or_else(|| CodecError::GzipError("Unexpected end of deflate stream".to_string()))?;
        let btype = reader
            .read_bits(2)
            .ok_or_else(|| CodecError::GzipError("Unexpected end of deflate stream".to_string()))?;

        match btype {
            0 => {
                // Non-compressed / Stored block
                reader.align_byte();
                if reader.byte_pos + 4 > reader.data.len() {
                    return Err(CodecError::GzipError("Stored block truncated".to_string()));
                }
                let len = u16::from_le_bytes([
                    reader.data[reader.byte_pos],
                    reader.data[reader.byte_pos + 1],
                ]) as usize;
                let nlen = u16::from_le_bytes([
                    reader.data[reader.byte_pos + 2],
                    reader.data[reader.byte_pos + 3],
                ]) as usize;
                reader.byte_pos += 4;

                if (len ^ 0xFFFF) != nlen {
                    return Err(CodecError::GzipError(
                        "Stored block NLEN check failed".to_string(),
                    ));
                }

                if reader.byte_pos + len > reader.data.len() {
                    return Err(CodecError::GzipError(
                        "Stored block data exceeds stream".to_string(),
                    ));
                }

                if out.len() + len > max_bytes {
                    return Err(CodecError::DecompressionBomb { max_bytes });
                }

                out.extend_from_slice(&reader.data[reader.byte_pos..reader.byte_pos + len]);
                reader.byte_pos += len;
            }
            1 => {
                // Fixed Huffman codes
                inflate_huffman_fixed(&mut reader, &mut out, max_bytes)?;
            }
            2 => {
                // Dynamic Huffman codes
                inflate_huffman_dynamic(&mut reader, &mut out, max_bytes)?;
            }
            _ => {
                return Err(CodecError::GzipError(
                    "Invalid deflate block type (btype=3)".to_string(),
                ));
            }
        }

        if bfinal == 1 {
            break;
        }
    }

    Ok(out)
}

fn inflate_huffman_fixed(
    reader: &mut BitReader,
    out: &mut Vec<u8>,
    max_bytes: usize,
) -> Result<(), CodecError> {
    loop {
        let sym = decode_fixed_lit_len(reader)?;
        if sym < 256 {
            if out.len() >= max_bytes {
                return Err(CodecError::DecompressionBomb { max_bytes });
            }
            out.push(sym as u8);
        } else if sym == 256 {
            // End of block
            break;
        } else {
            let (length, dist) = decode_lz77_match(reader, sym)?;
            if out.len() + length > max_bytes {
                return Err(CodecError::DecompressionBomb { max_bytes });
            }
            if dist > out.len() {
                return Err(CodecError::GzipError(
                    "LZ77 distance exceeds output buffer".to_string(),
                ));
            }
            let start = out.len() - dist;
            for i in 0..length {
                let b = out[start + i];
                out.push(b);
            }
        }
    }
    Ok(())
}

fn decode_fixed_lit_len(reader: &mut BitReader) -> Result<u32, CodecError> {
    // 0..=143: 8 bits (00110000..=10111111) -> 0x30..=0xBF
    // 144..=255: 9 bits (110010000..=111111111) -> 0x190..=0x1FF
    // 256..=279: 7 bits (0000000..=0010111) -> 0x00..=0x17
    // 280..=287: 8 bits (11000000..=11000111) -> 0xC0..=0xC7
    let mut code = 0u32;
    for len in 1..=9 {
        let bit = reader
            .read_bits(1)
            .ok_or_else(|| CodecError::GzipError("EOF reading Huffman code".to_string()))?;
        code = (code << 1) | bit;

        if len == 7 && code <= 0x17 {
            return Ok(256 + code);
        }
        if len == 8 {
            if code >= 0x30 && code <= 0xBF {
                return Ok(code - 0x30);
            }
            if code >= 0xC0 && code <= 0xC7 {
                return Ok(280 + (code - 0xC0));
            }
        }
        if len == 9 && code >= 0x190 && code <= 0x1FF {
            return Ok(144 + (code - 0x190));
        }
    }
    Err(CodecError::GzipError("Invalid fixed Huffman symbol".to_string()))
}

fn decode_lz77_match(reader: &mut BitReader, sym: u32) -> Result<(usize, usize), CodecError> {
    let (base_len, extra_bits) = match sym {
        257..=264 => (3 + (sym - 257) as usize, 0),
        265..=268 => (11 + ((sym - 265) * 2) as usize, 1),
        269..=272 => (19 + ((sym - 269) * 4) as usize, 2),
        273..=276 => (35 + ((sym - 273) * 8) as usize, 3),
        277..=280 => (67 + ((sym - 277) * 16) as usize, 4),
        281..=284 => (131 + ((sym - 281) * 32) as usize, 5),
        285 => (258, 0),
        _ => return Err(CodecError::GzipError("Invalid length code".to_string())),
    };

    let extra_len = if extra_bits > 0 {
        reader.read_bits(extra_bits).ok_or_else(|| {
            CodecError::GzipError("EOF reading extra length bits".to_string())
        })? as usize
    } else {
        0
    };
    let length = base_len + extra_len;

    // Fixed distance: 5 bits code (0..29)
    let dist_code = reader
        .read_bits(5)
        .ok_or_else(|| CodecError::GzipError("EOF reading distance code".to_string()))?;
    let (base_dist, dist_extra_bits) = match dist_code {
        0..=3 => (1 + dist_code as usize, 0),
        4..=5 => (5 + ((dist_code - 4) * 2) as usize, 1),
        6..=7 => (9 + ((dist_code - 6) * 4) as usize, 2),
        8..=9 => (17 + ((dist_code - 8) * 8) as usize, 3),
        10..=11 => (33 + ((dist_code - 10) * 16) as usize, 4),
        12..=13 => (65 + ((dist_code - 12) * 32) as usize, 5),
        14..=15 => (129 + ((dist_code - 14) * 64) as usize, 6),
        16..=17 => (257 + ((dist_code - 16) * 128) as usize, 7),
        18..=19 => (513 + ((dist_code - 18) * 256) as usize, 8),
        20..=21 => (1025 + ((dist_code - 20) * 512) as usize, 9),
        22..=23 => (2049 + ((dist_code - 22) * 1024) as usize, 10),
        24..=25 => (4097 + ((dist_code - 24) * 2048) as usize, 11),
        26..=27 => (8193 + ((dist_code - 26) * 4096) as usize, 12),
        28..=29 => (16385 + ((dist_code - 28) * 8192) as usize, 13),
        _ => return Err(CodecError::GzipError("Invalid distance code".to_string())),
    };

    let dist_extra = if dist_extra_bits > 0 {
        reader.read_bits(dist_extra_bits).ok_or_else(|| {
            CodecError::GzipError("EOF reading extra distance bits".to_string())
        })? as usize
    } else {
        0
    };
    let dist = base_dist + dist_extra;

    Ok((length, dist))
}

fn inflate_huffman_dynamic(
    reader: &mut BitReader,
    out: &mut Vec<u8>,
    max_bytes: usize,
) -> Result<(), CodecError> {
    let hlit = reader
        .read_bits(5)
        .ok_or_else(|| CodecError::GzipError("EOF reading HLIT".to_string()))?
        as usize
        + 257;
    let hdist = reader
        .read_bits(5)
        .ok_or_else(|| CodecError::GzipError("EOF reading HDIST".to_string()))?
        as usize
        + 1;
    let hclen = reader
        .read_bits(4)
        .ok_or_else(|| CodecError::GzipError("EOF reading HCLEN".to_string()))?
        as usize
        + 4;

    const CL_ORDER: [usize; 19] = [
        16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
    ];
    let mut cl_lens = [0u8; 19];
    for i in 0..hclen {
        let len = reader
            .read_bits(3)
            .ok_or_else(|| CodecError::GzipError("EOF reading code length".to_string()))?
            as u8;
        cl_lens[CL_ORDER[i]] = len;
    }

    // Build code length Huffman tree
    let cl_tree = build_huffman_tree(&cl_lens)?;

    // Decode literal/length + distance code lengths
    let total_codes = hlit + hdist;
    let mut lit_dist_lens = Vec::with_capacity(total_codes);

    while lit_dist_lens.len() < total_codes {
        let sym = decode_symbol(reader, &cl_tree)?;
        match sym {
            0..=15 => lit_dist_lens.push(sym as u8),
            16 => {
                let repeat = reader
                    .read_bits(2)
                    .ok_or_else(|| CodecError::GzipError("EOF reading repeat bits".to_string()))?
                    as usize
                    + 3;
                let prev = *lit_dist_lens
                    .last()
                    .ok_or_else(|| CodecError::GzipError("Repeat with no prev code".to_string()))?;
                for _ in 0..repeat {
                    lit_dist_lens.push(prev);
                }
            }
            17 => {
                let repeat = reader
                    .read_bits(3)
                    .ok_or_else(|| CodecError::GzipError("EOF reading repeat bits".to_string()))?
                    as usize
                    + 3;
                for _ in 0..repeat {
                    lit_dist_lens.push(0);
                }
            }
            18 => {
                let repeat = reader
                    .read_bits(7)
                    .ok_or_else(|| CodecError::GzipError("EOF reading repeat bits".to_string()))?
                    as usize
                    + 11;
                for _ in 0..repeat {
                    lit_dist_lens.push(0);
                }
            }
            _ => return Err(CodecError::GzipError("Invalid code length symbol".to_string())),
        }
    }

    let lit_tree = build_huffman_tree(&lit_dist_lens[..hlit])?;
    let dist_tree = build_huffman_tree(&lit_dist_lens[hlit..])?;

    // Decode payload
    loop {
        let sym = decode_symbol(reader, &lit_tree)?;
        if sym < 256 {
            if out.len() >= max_bytes {
                return Err(CodecError::DecompressionBomb { max_bytes });
            }
            out.push(sym as u8);
        } else if sym == 256 {
            break;
        } else {
            // LZ77 match
            let (base_len, extra_bits) = match sym {
                257..=264 => (3 + (sym - 257) as usize, 0),
                265..=268 => (11 + ((sym - 265) * 2) as usize, 1),
                269..=272 => (19 + ((sym - 269) * 4) as usize, 2),
                273..=276 => (35 + ((sym - 273) * 8) as usize, 3),
                277..=280 => (67 + ((sym - 277) * 16) as usize, 4),
                281..=284 => (131 + ((sym - 281) * 32) as usize, 5),
                285 => (258, 0),
                _ => return Err(CodecError::GzipError("Invalid length code".to_string())),
            };
            let extra_len = if extra_bits > 0 {
                reader.read_bits(extra_bits).ok_or_else(|| {
                    CodecError::GzipError("EOF reading extra length".to_string())
                })? as usize
            } else {
                0
            };
            let length = base_len + extra_len;

            let dist_sym = decode_symbol(reader, &dist_tree)?;
            let (base_dist, dist_extra_bits) = match dist_sym {
                0..=3 => (1 + dist_sym as usize, 0),
                4..=5 => (5 + ((dist_sym - 4) * 2) as usize, 1),
                6..=7 => (9 + ((dist_sym - 6) * 4) as usize, 2),
                8..=9 => (17 + ((dist_sym - 8) * 8) as usize, 3),
                10..=11 => (33 + ((dist_sym - 10) * 16) as usize, 4),
                12..=13 => (65 + ((dist_sym - 12) * 32) as usize, 5),
                14..=15 => (129 + ((dist_sym - 14) * 64) as usize, 6),
                16..=17 => (257 + ((dist_sym - 16) * 128) as usize, 7),
                18..=19 => (513 + ((dist_sym - 18) * 256) as usize, 8),
                20..=21 => (1025 + ((dist_sym - 20) * 512) as usize, 9),
                22..=23 => (2049 + ((dist_sym - 22) * 1024) as usize, 10),
                24..=25 => (4097 + ((dist_sym - 24) * 2048) as usize, 11),
                26..=27 => (8193 + ((dist_sym - 26) * 4096) as usize, 12),
                28..=29 => (16385 + ((dist_sym - 28) * 8192) as usize, 13),
                _ => return Err(CodecError::GzipError("Invalid distance symbol".to_string())),
            };

            let dist_extra = if dist_extra_bits > 0 {
                reader.read_bits(dist_extra_bits).ok_or_else(|| {
                    CodecError::GzipError("EOF reading extra distance".to_string())
                })? as usize
            } else {
                0
            };
            let dist = base_dist + dist_extra;

            if out.len() + length > max_bytes {
                return Err(CodecError::DecompressionBomb { max_bytes });
            }
            if dist > out.len() {
                return Err(CodecError::GzipError(
                    "LZ77 distance exceeds output buffer".to_string(),
                ));
            }
            let start = out.len() - dist;
            for i in 0..length {
                let b = out[start + i];
                out.push(b);
            }
        }
    }

    Ok(())
}

struct HuffmanNode {
    symbol: Option<u32>,
    left: Option<Box<HuffmanNode>>,
    right: Option<Box<HuffmanNode>>,
}

fn build_huffman_tree(lengths: &[u8]) -> Result<HuffmanNode, CodecError> {
    let mut count = [0usize; 16];
    for &len in lengths {
        if len > 0 && len <= 15 {
            count[len as usize] += 1;
        }
    }

    let mut next_code = [0u32; 16];
    let mut code = 0u32;
    for len in 1..=15 {
        code = (code + count[len - 1] as u32) << 1;
        next_code[len] = code;
    }

    let mut root = HuffmanNode {
        symbol: None,
        left: None,
        right: None,
    };

    for (sym, &len) in lengths.iter().enumerate() {
        if len == 0 {
            continue;
        }
        let sym_code = next_code[len as usize];
        next_code[len as usize] += 1;

        let mut curr = &mut root;
        for bit_idx in (0..len).rev() {
            let bit = (sym_code >> bit_idx) & 1;
            if bit == 0 {
                if curr.left.is_none() {
                    curr.left = Some(Box::new(HuffmanNode {
                        symbol: None,
                        left: None,
                        right: None,
                    }));
                }
                curr = curr.left.as_mut().unwrap();
            } else {
                if curr.right.is_none() {
                    curr.right = Some(Box::new(HuffmanNode {
                        symbol: None,
                        left: None,
                        right: None,
                    }));
                }
                curr = curr.right.as_mut().unwrap();
            }
        }
        curr.symbol = Some(sym as u32);
    }

    Ok(root)
}

fn decode_symbol(reader: &mut BitReader, root: &HuffmanNode) -> Result<u32, CodecError> {
    let mut curr = root;
    loop {
        if let Some(sym) = curr.symbol {
            return Ok(sym);
        }
        let bit = reader
            .read_bits(1)
            .ok_or_else(|| CodecError::GzipError("EOF decoding Huffman symbol".to_string()))?;
        if bit == 0 {
            curr = curr
                .left
                .as_ref()
                .ok_or_else(|| CodecError::GzipError("Invalid Huffman bit path".to_string()))?;
        } else {
            curr = curr
                .right
                .as_ref()
                .ok_or_else(|| CodecError::GzipError("Invalid Huffman bit path".to_string()))?;
        }
    }
}

/// Computes CRC-32 (IEEE 802.3 polynomial: 0xEDB88320).
pub fn crc32_compute(data: &[u8]) -> u32 {
    let mut crc = 0xFFFFFFFFu32;
    for &b in data {
        crc ^= b as u32;
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0xEDB88320;
            } else {
                crc >>= 1;
            }
        }
    }
    !crc
}
