//! # UCMA-Response
//! Dynamic response normalization, structural tokenization, diffing, and DBMS error signature catalog for UCMA-X.

pub mod diff;
pub mod masking;
pub mod signatures;
pub mod structural;

pub use diff::{ResponseDiffResult, ResponseDiffer, ResponseDivergenceType};
pub use masking::{DynamicContentMasker, MaskingConfig};
pub use signatures::{DbmsErrorCatalog, DbmsErrorMatch, DbmsErrorSignature, DbmsType};
pub use structural::{HtmlStructuralTokenizer, JsonStructuralTokenizer, StructuralProfile, TextTokenizer};
