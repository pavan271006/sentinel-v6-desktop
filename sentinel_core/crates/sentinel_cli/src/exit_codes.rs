//! Security domain exit codes for CI/CD pipeline automation and deterministic CLI scripting.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i32)]
pub enum SecurityExitCode {
    /// 0: Clean execution. No vulnerabilities found at or above the configured severity threshold.
    Clean = 0,
    /// 1: Security vulnerabilities detected and verified in target scope.
    VulnerabilitiesFound = 1,
    /// 2: Operational error, invalid CLI arguments, network fault, or SEC-01 scope violation.
    OperationalError = 2,
}

impl SecurityExitCode {
    pub fn as_i32(self) -> i32 {
        self as i32
    }

    pub fn exit_process(self) -> ! {
        std::process::exit(self as i32);
    }
}
