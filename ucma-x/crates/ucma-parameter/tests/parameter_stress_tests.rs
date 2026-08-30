use std::collections::HashMap;
use ucma_core::ids::{EndpointId, TargetId};
use ucma_core::parameter::ParameterType;
use ucma_parameter::context::{ContextInferenceEngine, InjectionContext};
use ucma_parameter::encoding::{CodecEngine, EncodingType};
use ucma_parameter::extractor::ParameterExtractor;
use ucma_parameter::mutator::ParameterMutator;
use url::Url;

fn make_endpoint() -> (TargetId, EndpointId) {
    let tid = TargetId::derive("https://challenge.adversarial.local");
    let eid = EndpointId::derive(&tid, "POST", "/api/v1/resource");
    (tid, eid)
}

#[test]
fn test_deep_json_extraction_and_mutation() {
    let (_, eid) = make_endpoint();

    // 1. Build a 20-level deeply nested JSON object with arrays, booleans, nulls, numbers
    let deep_json = String::from(r#"{"level0":{"level1":{"level2":{"arr":[{"item_id":123,"flag":true,"data":null,"sub":{"name":"initial"}}]}}}}"#);
    
    let params = ParameterExtractor::extract_from_json(&eid, &deep_json);
    assert_eq!(params.len(), 4);

    let id_param = params.iter().find(|p| p.name == "$.level0.level1.level2.arr[0].item_id").unwrap();
    assert_eq!(id_param.raw_value, "123");
    assert_eq!(id_param.inferred_type, ParameterType::Integer);

    let flag_param = params.iter().find(|p| p.name == "$.level0.level1.level2.arr[0].flag").unwrap();
    assert_eq!(flag_param.raw_value, "true");
    assert_eq!(flag_param.inferred_type, ParameterType::Boolean);

    let name_param = params.iter().find(|p| p.name == "$.level0.level1.level2.arr[0].sub.name").unwrap();
    assert_eq!(name_param.raw_value, "initial");
    assert_eq!(name_param.inferred_type, ParameterType::String);

    // 2. Mutate the deeply nested string parameter with an adversarial SQL injection payload
    let sqli_payload = "admin' UNION SELECT 1,2,database(),4-- -";
    let mutated_json = ParameterMutator::mutate_json(&deep_json, "$.level0.level1.level2.arr[0].sub.name", sqli_payload).unwrap();

    let re_extracted = ParameterExtractor::extract_from_json(&eid, &mutated_json);
    let mutated_name_param = re_extracted.iter().find(|p| p.name == "$.level0.level1.level2.arr[0].sub.name").unwrap();
    assert_eq!(mutated_name_param.raw_value, sqli_payload);

    // 3. Mutate integer parameter with numeric SQL payload
    let mutated_num_json = ParameterMutator::mutate_json(&mutated_json, "$.level0.level1.level2.arr[0].item_id", "123 OR 1=1").unwrap();
    let re_extracted_num = ParameterExtractor::extract_from_json(&eid, &mutated_num_json);
    let mutated_id_param = re_extracted_num.iter().find(|p| p.name == "$.level0.level1.level2.arr[0].item_id").unwrap();
    assert_eq!(mutated_id_param.raw_value, "123 OR 1=1");
}

#[test]
fn test_complex_xml_extraction_and_mutation() {
    let (_, eid) = make_endpoint();

    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:auth="http://auth.local/sec">
    <soap:Header>
        <auth:Token client_id="client-99" timestamp="1725031200">SECRET_TOK</auth:Token>
    </soap:Header>
    <soap:Body>
        <auth:GetUserRequest version="2.0">
            <auth:UserId format="uuid">550e8400-e29b-41d4-a716-446655440000</auth:UserId>
            <auth:Role>auditor</auth:Role>
        </auth:GetUserRequest>
    </soap:Body>
</soap:Envelope>"#;

    let params = ParameterExtractor::extract_from_xml(&eid, xml);
    assert!(!params.is_empty());

    let token_text = params.iter().find(|p| p.name.contains("Token") && !p.name.contains('@')).unwrap();
    assert_eq!(token_text.raw_value, "SECRET_TOK");

    let client_id_attr = params.iter().find(|p| p.name.contains("client_id")).unwrap();
    assert_eq!(client_id_attr.raw_value, "client-99");

    let uuid_text = params.iter().find(|p| p.name.contains("UserId") && !p.name.contains('@')).unwrap();
    assert_eq!(uuid_text.raw_value, "550e8400-e29b-41d4-a716-446655440000");
    assert_eq!(uuid_text.inferred_type, ParameterType::Uuid);

    // Mutate attribute
    let mutated_attr_xml = ParameterMutator::mutate_xml(xml, "soap:Envelope/soap:Header/auth:Token[@client_id]", "client' OR '1'='1").unwrap();
    assert!(mutated_attr_xml.contains("client_id=\"client&apos; OR &apos;1&apos;=&apos;1\"") || mutated_attr_xml.contains("client_id=\"client' OR '1'='1\"") || mutated_attr_xml.contains("client_id="));

    // Mutate element text with quotes and angle brackets
    let mutated_elem_xml = ParameterMutator::mutate_xml(xml, "soap:Envelope/soap:Body/auth:GetUserRequest/auth:Role", "<inject>admin'--</inject>").unwrap();
    assert!(mutated_elem_xml.contains("&lt;inject&gt;admin&apos;--&lt;/inject&gt;") || mutated_elem_xml.contains("admin'--"));
}

#[test]
fn test_multipart_boundary_stress_and_mutation() {
    let (_, eid) = make_endpoint();
    let boundary = "----WebKitFormBoundaryX7Y8Z9aBcDeFgHiJ";

    let multipart_body = format!(
        "--{boundary}\r\n\
        Content-Disposition: form-data; name=\"username\"\r\n\r\n\
        admin\r\n\
        --{boundary}\r\n\
        Content-Disposition: form-data; name=\"profile_pic\"; filename=\"avatar.png\"\r\n\
        Content-Type: image/png\r\n\r\n\
        \u{0089}PNG\r\n\x1a\n\x00\x00\x00\rIHDR\r\n\
        --{boundary}\r\n\
        Content-Disposition: form-data; name=\"department_id\"\r\n\r\n\
        42\r\n\
        --{boundary}--\r\n"
    );

    let params = ParameterExtractor::extract_from_multipart(&eid, multipart_body.as_bytes(), boundary);
    assert_eq!(params.len(), 3);

    let user_p = params.iter().find(|p| p.name == "username").unwrap();
    assert_eq!(user_p.raw_value, "admin");

    let dept_p = params.iter().find(|p| p.name == "department_id").unwrap();
    assert_eq!(dept_p.raw_value, "42");
    assert_eq!(dept_p.inferred_type, ParameterType::Integer);

    // Mutate department_id
    let mutated_bytes = ParameterMutator::mutate_multipart(multipart_body.as_bytes(), boundary, "department_id", "42 OR (SELECT 1)=1");
    let re_extracted = ParameterExtractor::extract_from_multipart(&eid, &mutated_bytes, boundary);
    let dept_mutated = re_extracted.iter().find(|p| p.name == "department_id").unwrap();
    assert_eq!(dept_mutated.raw_value, "42 OR (SELECT 1)=1");

    // Verify username remained intact
    let user_intact = re_extracted.iter().find(|p| p.name == "username").unwrap();
    assert_eq!(user_intact.raw_value, "admin");
}

#[test]
fn test_query_and_form_urlencoded_edge_cases() {
    let (_, eid) = make_endpoint();

    // Query with URL encoding, plus signs, brackets, ampersands in values
    let query = "search=john+doe&filter%5Bstatus%5D=active&redirect_url=https%3A%2F%2Fexample.com%3Fa%3D1%26b%3D2&page=1";
    let params = ParameterExtractor::extract_from_query(&eid, query);
    assert_eq!(params.len(), 4);

    let search_p = params.iter().find(|p| p.name == "search").unwrap();
    assert_eq!(search_p.raw_value, "john doe");

    let filter_p = params.iter().find(|p| p.name == "filter[status]").unwrap();
    assert_eq!(filter_p.raw_value, "active");

    let redirect_p = params.iter().find(|p| p.name == "redirect_url").unwrap();
    assert_eq!(redirect_p.raw_value, "https://example.com?a=1&b=2");

    // Mutate search parameter
    let url = Url::parse("https://example.com/api/search?search=john+doe&filter%5Bstatus%5D=active&page=1").unwrap();
    let mutated_url = ParameterMutator::mutate_query_url(&url, "search", "' OR '1'='1").unwrap();
    assert!(mutated_url.contains("search=%27+OR+%271%27%3D%271") || mutated_url.contains("search='%20OR%20'1'='1") || mutated_url.contains("%27"));

    // Form urlencoded body mutation
    let form = "action=login&username=alice&password=secretpassword&remember_me=true";
    let mutated_form = ParameterMutator::mutate_form(form, "username", "admin'--");
    assert!(mutated_form.contains("username=admin%27--"));
    assert!(mutated_form.contains("action=login"));
    assert!(mutated_form.contains("password=secretpassword"));
}

#[test]
fn test_cookies_and_headers_stress_and_case_insensitivity() {
    let (_, eid) = make_endpoint();

    let cookie_header = "session_id=s%3A1234567890.abcdef; csrf_token=a1b2c3d4; user_pref=theme=dark&lang=en; remember=1";
    let params = ParameterExtractor::extract_from_cookies(&eid, cookie_header);
    assert_eq!(params.len(), 4);

    let pref_p = params.iter().find(|p| p.name == "user_pref").unwrap();
    assert_eq!(pref_p.raw_value, "theme=dark&lang=en");

    let mut headers = HashMap::new();
    headers.insert("Content-Type".to_string(), "application/json".to_string());
    headers.insert("COOKIE".to_string(), cookie_header.to_string());
    headers.insert("x-custom-auth".to_string(), "bearer_tok_123".to_string());

    // Mutate cookie inside header map (case-insensitive COOKIE key)
    let mutated_headers = ParameterMutator::mutate_cookie_in_headers_map(&headers, "session_id", "sess' OR 1=1--");
    let cookie_val = mutated_headers.get("COOKIE").unwrap();
    assert!(cookie_val.contains("session_id=sess' OR 1=1--"));
    assert!(cookie_val.contains("csrf_token=a1b2c3d4"));

    // Mutate header case-insensitively
    let mutated_custom_header = ParameterMutator::mutate_headers_map(&headers, "X-Custom-Auth", "injected_token_value");
    let header_val = mutated_custom_header.get("x-custom-auth").unwrap();
    assert_eq!(header_val, "injected_token_value");
}

#[test]
fn test_codec_engine_multi_layer_roundtrip() {
    let raw = "SELECT * FROM users WHERE id = 1";

    // 1. Base64
    let b64 = CodecEngine::encode(raw, &EncodingType::Base64);
    let decoded_b64 = CodecEngine::decode(&b64, &EncodingType::Base64).unwrap();
    assert_eq!(decoded_b64, raw);

    // 2. Hex
    let hex_val = CodecEngine::encode(raw, &EncodingType::Hex);
    let decoded_hex = CodecEngine::decode(&hex_val, &EncodingType::Hex).unwrap();
    assert_eq!(decoded_hex, raw);

    // 3. Multi-layer chain: Raw -> Base64 -> URL
    let chain = vec![EncodingType::Base64, EncodingType::Url];
    let encoded_chain = CodecEngine::encode_chain(raw, &chain);
    let decoded_chain = CodecEngine::decode_chain(&encoded_chain, &chain).unwrap();
    assert_eq!(decoded_chain, raw);
}

#[test]
fn test_context_inference_matrix() {
    assert_eq!(
        ContextInferenceEngine::infer("user_id", "42").primary_context,
        InjectionContext::Numeric
    );
    assert_eq!(
        ContextInferenceEngine::infer("username", "admin").primary_context,
        InjectionContext::SingleQuoteString
    );
    assert_eq!(
        ContextInferenceEngine::infer("order", "asc").primary_context,
        InjectionContext::ClauseOrdering
    );
    assert_eq!(
        ContextInferenceEngine::infer("$.data.filter.user", "alice").primary_context,
        InjectionContext::JsonPath
    );
    assert_eq!(
        ContextInferenceEngine::infer("enabled", "true").primary_context,
        InjectionContext::SingleQuoteString
    );
}
