//! Standalone Keccak-256 cryptographic hash implementation.
//!
//! Conforms to Ethereum/Web3 Keccak-256 standard (FIPS 202 sponge with domain suffix 0x01).

const RC: [u64; 24] = [
    0x0000000000000001, 0x0000000000008082, 0x800000000000808A, 0x8000000080008000,
    0x000000000000808B, 0x0000000080000001, 0x8000000080008081, 0x8000000000008009,
    0x000000000000008A, 0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
    0x000000008000808B, 0x800000000000008B, 0x8000000000008089, 0x8000000000008003,
    0x8000000000008002, 0x8000000000000080, 0x000000000000800A, 0x800000008000000A,
    0x8000000080008081, 0x8000000000008080, 0x0000000080000001, 0x8000000080008008,
];

const RHO: [u32; 24] = [
    1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44,
];

const PI: [usize; 24] = [
    10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1,
];

pub fn keccak256(data: &[u8]) -> [u8; 32] {
    let rate = 136; // 1088 bits / 8
    let mut state = [0u64; 25];

    // Absorbing phase
    let mut offset = 0;
    while offset + rate <= data.len() {
        for i in 0..(rate / 8) {
            let chunk = u64::from_le_bytes([
                data[offset + i * 8],
                data[offset + i * 8 + 1],
                data[offset + i * 8 + 2],
                data[offset + i * 8 + 3],
                data[offset + i * 8 + 4],
                data[offset + i * 8 + 5],
                data[offset + i * 8 + 6],
                data[offset + i * 8 + 7],
            ]);
            state[i] ^= chunk;
        }
        keccak_f1600(&mut state);
        offset += rate;
    }

    // Padding (Keccak-256 pad10*1 with 0x01 prefix)
    let rem = &data[offset..];
    let mut block = [0u8; 136];
    block[..rem.len()].copy_from_slice(rem);
    block[rem.len()] = 0x01; // Keccak domain separator / pad start
    block[rate - 1] |= 0x80; // Pad end

    for i in 0..(rate / 8) {
        let chunk = u64::from_le_bytes([
            block[i * 8],
            block[i * 8 + 1],
            block[i * 8 + 2],
            block[i * 8 + 3],
            block[i * 8 + 4],
            block[i * 8 + 5],
            block[i * 8 + 6],
            block[i * 8 + 7],
        ]);
        state[i] ^= chunk;
    }
    keccak_f1600(&mut state);

    // Squeezing phase (first 32 bytes)
    let mut out = [0u8; 32];
    for i in 0..4 {
        let bytes = state[i].to_le_bytes();
        out[i * 8..(i + 1) * 8].copy_from_slice(&bytes);
    }

    out
}

fn keccak_f1600(state: &mut [u64; 25]) {
    for round in 0..24 {
        // 1. Theta
        let mut c = [0u64; 5];
        for x in 0..5 {
            c[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
        }
        let mut d = [0u64; 5];
        for x in 0..5 {
            d[x] = c[(x + 4) % 5] ^ c[(x + 1) % 5].rotate_left(1);
        }
        for x in 0..5 {
            for y in 0..5 {
                state[x + y * 5] ^= d[x];
            }
        }

        // 2. Rho and Pi
        let mut last = state[1];
        for i in 0..24 {
            let j = PI[i];
            let temp = state[j];
            state[j] = last.rotate_left(RHO[i]);
            last = temp;
        }

        // 3. Chi
        for y in 0..5 {
            let offset = y * 5;
            let a0 = state[offset];
            let a1 = state[offset + 1];
            let a2 = state[offset + 2];
            let a3 = state[offset + 3];
            let a4 = state[offset + 4];

            state[offset] ^= !a1 & a2;
            state[offset + 1] ^= !a2 & a3;
            state[offset + 2] ^= !a3 & a4;
            state[offset + 3] ^= !a4 & a0;
            state[offset + 4] ^= !a0 & a1;
        }

        // 4. Iota
        state[0] ^= RC[round];
    }
}
