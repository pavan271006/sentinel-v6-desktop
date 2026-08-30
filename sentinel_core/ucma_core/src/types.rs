#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub enum Dialect {
    PostgreSql = 0,
    MySql      = 1,
    Sqlite     = 2,
    MsSql      = 3,
    Oracle     = 4,
    Generic    = 5,
}

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub enum InjectionContext {
    NumericScalar            = 0,
    StringSingleQuote        = 1,
    StringDoubleQuote        = 2,
    OrderByIdentifier        = 3,
    ColumnOrTableIdentifier  = 4,
    JsonXmlOperator          = 5,
    SubqueryExpression       = 6,
    SafeUninjectable         = 7,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ParameterProfile {
    pub name: String,
    pub original_value: String,
    pub encoding_chain: Vec<String>,
    pub reflection_indices: Vec<usize>,
    pub prior_alphas: [f64; 8],
}
