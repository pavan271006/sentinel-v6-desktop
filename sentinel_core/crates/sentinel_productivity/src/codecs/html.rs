//! HTML entity encoder and decoder supporting Named, Decimal, Hex, and full bypass variants.

use super::{CodecError, HtmlEntityMode};
use std::collections::HashMap;

/// Encodes text into HTML entities based on selected mode.
pub fn encode_html(input: &str, mode: HtmlEntityMode) -> String {
    match mode {
        HtmlEntityMode::Named => {
            let mut out = String::with_capacity(input.len() * 2);
            for c in input.chars() {
                match c {
                    '&' => out.push_str("&amp;"),
                    '<' => out.push_str("&lt;"),
                    '>' => out.push_str("&gt;"),
                    '"' => out.push_str("&quot;"),
                    '\'' => out.push_str("&apos;"),
                    _ => out.push(c),
                }
            }
            out
        }
        HtmlEntityMode::Decimal => {
            let mut out = String::with_capacity(input.len() * 2);
            for c in input.chars() {
                match c {
                    '&' | '<' | '>' | '"' | '\'' => out.push_str(&format!("&#{};", c as u32)),
                    _ => out.push(c),
                }
            }
            out
        }
        HtmlEntityMode::Hex => {
            let mut out = String::with_capacity(input.len() * 2);
            for c in input.chars() {
                match c {
                    '&' | '<' | '>' | '"' | '\'' => out.push_str(&format!("&#x{:02x};", c as u32)),
                    _ => out.push(c),
                }
            }
            out
        }
        HtmlEntityMode::AllCharactersDec => {
            let mut out = String::with_capacity(input.len() * 5);
            for c in input.chars() {
                out.push_str(&format!("&#{};", c as u32));
            }
            out
        }
        HtmlEntityMode::AllCharactersHex => {
            let mut out = String::with_capacity(input.len() * 6);
            for c in input.chars() {
                out.push_str(&format!("&#x{:02x};", c as u32));
            }
            out
        }
    }
}

/// Decodes HTML entities into Unicode string.
pub fn decode_html(input: &str) -> Result<String, CodecError> {
    let mut out = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let len = chars.len();
    let mut i = 0;

    let named_entities: HashMap<&'static str, char> = [
        ("quot", '"'),
        ("amp", '&'),
        ("apos", '\''),
        ("lt", '<'),
        ("gt", '>'),
        ("nbsp", '\u{00A0}'),
        ("iexcl", '¡'),
        ("cent", '¢'),
        ("pound", '£'),
        ("curren", '¤'),
        ("yen", '¥'),
        ("brvbar", '¦'),
        ("sect", '§'),
        ("uml", '¨'),
        ("copy", '©'),
        ("ordf", 'ª'),
        ("laquo", '«'),
        ("not", '¬'),
        ("shy", '\u{00AD}'),
        ("reg", '®'),
        ("macr", '¯'),
        ("deg", '°'),
        ("plusmn", '±'),
        ("sup2", '²'),
        ("sup3", '³'),
        ("acute", '´'),
        ("micro", 'µ'),
        ("para", '¶'),
        ("middot", '·'),
        ("cedil", '¸'),
        ("sup1", '¹'),
        ("ordm", 'º'),
        ("raquo", '»'),
        ("frac14", '¼'),
        ("frac12", '½'),
        ("frac34", '¾'),
        ("iquest", '¿'),
        ("times", '×'),
        ("divide", '÷'),
        ("euro", '€'),
        ("trade", '™'),
        ("hellip", '…'),
        ("mdash", '—'),
        ("ndash", '–'),
        ("lsquo", '‘'),
        ("rsquo", '’'),
        ("ldquo", '“'),
        ("rdquo", '”'),
        ("bull", '•'),
        ("larr", '←'),
        ("rarr", '→'),
        ("uarr", '↑'),
        ("darr", '↓'),
    ]
    .iter()
    .cloned()
    .collect();

    while i < len {
        if chars[i] == '&' {
            // Check for numeric entity: &#...; or &#x...;
            if i + 1 < len && chars[i + 1] == '#' {
                let is_hex = i + 2 < len && (chars[i + 2] == 'x' || chars[i + 2] == 'X');
                let start_digits = if is_hex { i + 3 } else { i + 2 };
                let mut end_digits = start_digits;

                while end_digits < len && chars[end_digits] != ';' && chars[end_digits] != '&' && !chars[end_digits].is_whitespace() {
                    end_digits += 1;
                }

                let num_str: String = chars[start_digits..end_digits].iter().collect();
                let parsed_char = if is_hex {
                    u32::from_str_radix(&num_str, 16).ok().and_then(char::from_u32)
                } else {
                    num_str.parse::<u32>().ok().and_then(char::from_u32)
                };

                if let Some(ch) = parsed_char {
                    out.push(ch);
                    i = if end_digits < len && chars[end_digits] == ';' {
                        end_digits + 1
                    } else {
                        end_digits
                    };
                    continue;
                }
            } else {
                // Check for named entity: &name;
                let mut end_name = i + 1;
                while end_name < len && chars[end_name].is_alphanumeric() {
                    end_name += 1;
                }

                let name_str: String = chars[i + 1..end_name].iter().collect();
                if let Some(&ch) = named_entities.get(name_str.as_str()) {
                    out.push(ch);
                    i = if end_name < len && chars[end_name] == ';' {
                        end_name + 1
                    } else {
                        end_name
                    };
                    continue;
                }
            }

            // If not a recognized entity, push '&' literally
            out.push('&');
            i += 1;
        } else {
            out.push(chars[i]);
            i += 1;
        }
    }

    Ok(out)
}
