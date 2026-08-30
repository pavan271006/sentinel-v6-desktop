//! Unified HashEngine implementation supporting MD5, SHA-1, SHA-256, SHA-384, SHA-512,
//! Keccak-256, and constant-time HMAC verification.

use super::keccak::keccak256;
use super::{HashAlgorithm, HashOutput, HmacAlgorithm};
use crate::codecs::{encode_base64, Base64Variant};
use sha2::{Digest, Sha256, Sha384, Sha512};
use std::collections::HashMap;

pub struct HashEngine;

impl HashEngine {
    /// Computes digest for the given algorithm.
    pub fn digest(algo: HashAlgorithm, data: &[u8]) -> HashOutput {
        let raw = match algo {
            HashAlgorithm::Md5 => md5_digest(data).to_vec(),
            HashAlgorithm::Sha1 => sha1_digest(data).to_vec(),
            HashAlgorithm::Sha256 => Sha256::digest(data).to_vec(),
            HashAlgorithm::Sha384 => Sha384::digest(data).to_vec(),
            HashAlgorithm::Sha512 => Sha512::digest(data).to_vec(),
            HashAlgorithm::Keccak256 => keccak256(data).to_vec(),
        };

        let hex_str = hex::encode(&raw);
        let b64_str = encode_base64(&raw, Base64Variant::Standard);

        HashOutput {
            algorithm: algo.as_str().to_string(),
            raw,
            hex: hex_str,
            base64: b64_str,
        }
    }

    /// Computes all standard cryptographic digests simultaneously over input data.
    pub fn digest_all(data: &[u8]) -> HashMap<HashAlgorithm, HashOutput> {
        let algos = [
            HashAlgorithm::Md5,
            HashAlgorithm::Sha1,
            HashAlgorithm::Sha256,
            HashAlgorithm::Sha384,
            HashAlgorithm::Sha512,
            HashAlgorithm::Keccak256,
        ];

        let mut map = HashMap::with_capacity(algos.len());
        for algo in algos {
            map.insert(algo, Self::digest(algo, data));
        }
        map
    }

    /// Computes HMAC over data using secret key.
    pub fn hmac(algo: HmacAlgorithm, key: &[u8], data: &[u8]) -> HashOutput {
        let raw = match algo {
            HmacAlgorithm::HmacMd5 => compute_hmac(key, data, 64, |k| md5_digest(k).to_vec(), |d| md5_digest(d).to_vec()),
            HmacAlgorithm::HmacSha1 => compute_hmac(key, data, 64, |k| sha1_digest(k).to_vec(), |d| sha1_digest(d).to_vec()),
            HmacAlgorithm::HmacSha256 => compute_hmac(key, data, 64, |k| Sha256::digest(k).to_vec(), |d| Sha256::digest(d).to_vec()),
            HmacAlgorithm::HmacSha512 => compute_hmac(key, data, 128, |k| Sha512::digest(k).to_vec(), |d| Sha512::digest(d).to_vec()),
        };

        let hex_str = hex::encode(&raw);
        let b64_str = encode_base64(&raw, Base64Variant::Standard);

        HashOutput {
            algorithm: algo.as_str().to_string(),
            raw,
            hex: hex_str,
            base64: b64_str,
        }
    }

    /// Constant-time verification of HMAC to prevent timing side-channel attacks.
    pub fn verify_hmac(algo: HmacAlgorithm, key: &[u8], data: &[u8], expected_mac: &[u8]) -> bool {
        let computed = Self::hmac(algo, key, data);
        constant_time_eq(&computed.raw, expected_mac)
    }

    /// Standalone Keccak-256 digest helper.
    pub fn keccak256(data: &[u8]) -> HashOutput {
        Self::digest(HashAlgorithm::Keccak256, data)
    }
}

/// Generic HMAC (RFC 2104) constructor.
fn compute_hmac<FKey, FHash>(
    key: &[u8],
    data: &[u8],
    block_size: usize,
    hash_key: FKey,
    hash_data: FHash,
) -> Vec<u8>
where
    FKey: Fn(&[u8]) -> Vec<u8>,
    FHash: Fn(&[u8]) -> Vec<u8>,
{
    let mut k = if key.len() > block_size {
        hash_key(key)
    } else {
        key.to_vec()
    };
    k.resize(block_size, 0);

    let mut ipad = vec![0x36u8; block_size];
    let mut opad = vec![0x5cu8; block_size];
    for i in 0..block_size {
        ipad[i] ^= k[i];
        opad[i] ^= k[i];
    }

    let mut inner_input = Vec::with_capacity(block_size + data.len());
    inner_input.extend_from_slice(&ipad);
    inner_input.extend_from_slice(data);
    let inner_hash = hash_data(&inner_input);

    let mut outer_input = Vec::with_capacity(block_size + inner_hash.len());
    outer_input.extend_from_slice(&opad);
    outer_input.extend_from_slice(&inner_hash);
    hash_data(&outer_input)
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut acc = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        acc |= x ^ y;
    }
    acc == 0
}

/// MD5 (RFC 1321) implementation.
pub fn md5_digest(data: &[u8]) -> [u8; 16] {
    let mut state = [0x67452301u32, 0xefcdab89u32, 0x98badcfeu32, 0x10325476u32];

    let bit_len = (data.len() as u64) * 8;
    let mut msg = data.to_vec();
    msg.push(0x80);
    while (msg.len() % 64) != 56 {
        msg.push(0x00);
    }
    msg.extend_from_slice(&bit_len.to_le_bytes());

    for chunk in msg.chunks(64) {
        let mut m = [0u32; 16];
        for i in 0..16 {
            m[i] = u32::from_le_bytes([
                chunk[i * 4],
                chunk[i * 4 + 1],
                chunk[i * 4 + 2],
                chunk[i * 4 + 3],
            ]);
        }

        let mut a = state[0];
        let mut b = state[1];
        let mut c = state[2];
        let mut d = state[3];

        let s: [u32; 64] = [
            7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
            5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
            4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
            6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
        ];

        let k: [u32; 64] = [
            0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
            0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
            0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
            0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
            0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
            0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
            0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
            0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
        ];

        for i in 0..64 {
            let (f, g) = if i < 16 {
                ((b & c) | (!b & d), i)
            } else if i < 32 {
                ((d & b) | (!d & c), (5 * i + 1) % 16)
            } else if i < 48 {
                (b ^ c ^ d, (3 * i + 5) % 16)
            } else {
                (c ^ (b | !d), (7 * i) % 16)
            };

            let temp = d;
            d = c;
            c = b;
            b = b.wrapping_add(a.wrapping_add(f).wrapping_add(k[i]).wrapping_add(m[g]).rotate_left(s[i]));
            a = temp;
        }

        state[0] = state[0].wrapping_add(a);
        state[1] = state[1].wrapping_add(b);
        state[2] = state[2].wrapping_add(c);
        state[3] = state[3].wrapping_add(d);
    }

    let mut out = [0u8; 16];
    out[0..4].copy_from_slice(&state[0].to_le_bytes());
    out[4..8].copy_from_slice(&state[1].to_le_bytes());
    out[8..12].copy_from_slice(&state[2].to_le_bytes());
    out[12..16].copy_from_slice(&state[3].to_le_bytes());
    out
}

/// SHA-1 (FIPS 180-1) implementation.
pub fn sha1_digest(data: &[u8]) -> [u8; 20] {
    let mut h = [
        0x67452301u32,
        0xEFCDAB89u32,
        0x98BADCFEu32,
        0x10325476u32,
        0xC3D2E1F0u32,
    ];

    let bit_len = (data.len() as u64) * 8;
    let mut msg = data.to_vec();
    msg.push(0x80);
    while (msg.len() % 64) != 56 {
        msg.push(0x00);
    }
    msg.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in msg.chunks(64) {
        let mut w = [0u32; 80];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([
                chunk[i * 4],
                chunk[i * 4 + 1],
                chunk[i * 4 + 2],
                chunk[i * 4 + 3],
            ]);
        }
        for i in 16..80 {
            w[i] = (w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]).rotate_left(1);
        }

        let mut a = h[0];
        let mut b = h[1];
        let mut c = h[2];
        let mut d = h[3];
        let mut e = h[4];

        for i in 0..80 {
            let (f, k) = if i < 20 {
                ((b & c) | (!b & d), 0x5A827999u32)
            } else if i < 40 {
                (b ^ c ^ d, 0x6ED9EBA1u32)
            } else if i < 60 {
                ((b & c) | (b & d) | (c & d), 0x8F1BBCDCu32)
            } else {
                (b ^ c ^ d, 0xCA62C1D6u32)
            };

            let temp = a
                .rotate_left(5)
                .wrapping_add(f)
                .wrapping_add(e)
                .wrapping_add(k)
                .wrapping_add(w[i]);
            e = d;
            d = c;
            c = b.rotate_left(30);
            b = a;
            a = temp;
        }

        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
    }

    let mut out = [0u8; 20];
    out[0..4].copy_from_slice(&h[0].to_be_bytes());
    out[4..8].copy_from_slice(&h[1].to_be_bytes());
    out[8..12].copy_from_slice(&h[2].to_be_bytes());
    out[12..16].copy_from_slice(&h[3].to_be_bytes());
    out[16..20].copy_from_slice(&h[4].to_be_bytes());
    out
}
