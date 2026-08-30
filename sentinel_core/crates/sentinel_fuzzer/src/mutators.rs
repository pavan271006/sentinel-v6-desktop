//! Mutation Engine & Fuzzing Payload Generators

use sentinel_common::enums::MutatorType;

pub struct FuzzMutator;

impl FuzzMutator {
    pub fn mutate(input: &[u8], mutator_type: MutatorType) -> Vec<Vec<u8>> {
        match mutator_type {
            MutatorType::Boundary => Self::generate_boundary_mutations(input),
            MutatorType::FormatString => Self::generate_format_string_mutations(input),
            MutatorType::UnicodeNormalization => Self::generate_unicode_mutations(input),
            MutatorType::BitFlip => Self::generate_bitflip_mutations(input),
            MutatorType::ByteReplace => Self::generate_byte_replace_mutations(input),
            MutatorType::Truncation => Self::generate_truncation_mutations(input),
            MutatorType::Wordlist => Self::generate_wordlist_mutations(),
            MutatorType::Grammar => Self::generate_grammar_mutations(input),
            MutatorType::Radamsa | MutatorType::AiAssisted => {
                Self::generate_random_mutations(input)
            }
        }
    }

    fn generate_boundary_mutations(_input: &[u8]) -> Vec<Vec<u8>> {
        vec![
            b"0".to_vec(),
            b"-1".to_vec(),
            b"2147483647".to_vec(),
            b"-2147483648".to_vec(),
            b"9223372036854775807".to_vec(),
            b"-9223372036854775808".to_vec(),
            b"1e309".to_vec(),
            b"-1e309".to_vec(),
            b"NaN".to_vec(),
            b"Infinity".to_vec(),
            b"-Infinity".to_vec(),
            b"null".to_vec(),
            b"undefined".to_vec(),
        ]
    }

    fn generate_format_string_mutations(_input: &[u8]) -> Vec<Vec<u8>> {
        vec![
            b"%s%s%s%s%s%s%s%s".to_vec(),
            b"%x%x%x%x%x%x%x%x".to_vec(),
            b"%n%n%n%n%n%n%n%n".to_vec(),
            b"%p%p%p%p%p%p%p%p".to_vec(),
            b"{{7*7}}".to_vec(),
            b"${7*7}".to_vec(),
            b"#{7*7}".to_vec(),
            b"<%= 7*7 %>".to_vec(),
            b"{{constructor.constructor('alert(1)')()}}".to_vec(),
        ]
    }

    fn generate_unicode_mutations(_input: &[u8]) -> Vec<Vec<u8>> {
        vec![
            b"\xC0\xAE\xC0\xAE\xC0\xAF".to_vec(),  // Overlong UTF-8 ../
            "\u{FF0F}admin".as_bytes().to_vec(),   // Fullwidth solidus
            "\u{0000}admin".as_bytes().to_vec(),   // Null byte injection
            "\u{202E}txt.exe".as_bytes().to_vec(), // Right-to-Left Override
            "\u{FEFF}".as_bytes().to_vec(),        // Byte Order Mark
        ]
    }

    fn generate_bitflip_mutations(input: &[u8]) -> Vec<Vec<u8>> {
        if input.is_empty() {
            return vec![vec![0x01], vec![0x80]];
        }

        let mut results = Vec::new();
        for i in 0..input.len().min(8) {
            for bit in 0..8 {
                let mut mutated = input.to_vec();
                mutated[i] ^= 1 << bit;
                results.push(mutated);
            }
        }
        results
    }

    fn generate_byte_replace_mutations(input: &[u8]) -> Vec<Vec<u8>> {
        let magic_bytes: &[u8] = &[0x00, 0xFF, 0x7F, 0x80, 0x0A, 0x0D, 0x22, 0x27, 0x3C, 0x3E];
        let mut results = Vec::new();

        for &b in magic_bytes {
            let mut mutated = input.to_vec();
            if mutated.is_empty() {
                mutated.push(b);
            } else {
                mutated[0] = b;
            }
            results.push(mutated);
        }
        results
    }

    fn generate_truncation_mutations(input: &[u8]) -> Vec<Vec<u8>> {
        let mut results = Vec::new();
        results.push(Vec::new()); // empty
        if input.len() > 1 {
            results.push(input[..input.len() / 2].to_vec());
            results.push(input[..1].to_vec());
        }
        results
    }

    fn generate_wordlist_mutations() -> Vec<Vec<u8>> {
        vec![
            b"' OR '1'='1".to_vec(),
            b"\" OR \"1\"=\"1".to_vec(),
            b"1; DROP TABLE users--".to_vec(),
            b"1' ORDER BY 1--".to_vec(),
            b"<script>alert(1)</script>".to_vec(),
            b"\"><script>alert(1)</script>".to_vec(),
            b"<img src=x onerror=alert(1)>".to_vec(),
            b"../../../../etc/passwd".to_vec(),
            b"..\\..\\..\\..\\windows\\win.ini".to_vec(),
            b"| id".to_vec(),
            b"; id".to_vec(),
            b"`id`".to_vec(),
            b"$(id)".to_vec(),
        ]
    }

    fn generate_grammar_mutations(input: &[u8]) -> Vec<Vec<u8>> {
        let mut results = Vec::new();
        let mut nested = Vec::new();
        nested.extend_from_slice(b"{\"nested\": ");
        nested.extend_from_slice(input);
        nested.extend_from_slice(b"}");
        results.push(nested);

        let mut array = Vec::new();
        array.extend_from_slice(b"[");
        array.extend_from_slice(input);
        array.extend_from_slice(b"]");
        results.push(array);

        results
    }

    fn generate_random_mutations(input: &[u8]) -> Vec<Vec<u8>> {
        let mut results = Vec::new();
        let mut repeated = input.to_vec();
        repeated.extend_from_slice(input);
        repeated.extend_from_slice(input);
        results.push(repeated);

        let mut padded = vec![0x41; 128]; // Buffer overflow probe
        padded.extend_from_slice(input);
        results.push(padded);

        results
    }
}
