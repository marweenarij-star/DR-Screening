# DR Screening - API Test Script
# Tests all routes for the Node.js backend

$baseUrl = "http://localhost:3000/api"
$passed = 0
$failed = 0
$adminToken = $null
$doctorToken = $null

function Test-Route {
    param (
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null,
        [string]$Token = $null,
        [string]$ContentType = "application/json"
    )
    
    try {
        $headers = @{}
        if ($Token) {
            $headers["Authorization"] = "Bearer $Token"
        }
        
        $params = @{
            Uri = $Url
            Method = $Method
            ContentType = $ContentType
            Headers = $headers
            ErrorAction = "Stop"
        }
        
        if ($Body -and $Method -ne "GET") {
            if ($Body -is [string]) {
                $params["Body"] = $Body
            } else {
                $params["Body"] = $Body | ConvertTo-Json -Depth 10
            }
        }
        
        $response = Invoke-RestMethod @params
        
        if ($response.success -eq $true -or $response.status -eq "ok") {
            Write-Host "[PASS] $Name" -ForegroundColor Green
            return @{ Success = $true; Data = $response }
        } else {
            Write-Host "[FAIL] $Name - $($response.error)" -ForegroundColor Red
            return @{ Success = $false; Data = $response }
        }
    } catch {
        Write-Host "[FAIL] $Name - $($_.Exception.Message)" -ForegroundColor Red
        return @{ Success = $false; Error = $_.Exception.Message }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  DR Screening - API Tests" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "--- HEALTH CHECK ---" -ForegroundColor Yellow
$result = Test-Route -Name "Health Check" -Url "$baseUrl/health"
if ($result.Success) { $passed++ } else { $failed++ }

# Test 2: Login as Admin
Write-Host "`n--- AUTHENTICATION ---" -ForegroundColor Yellow
$loginBody = @{ email = "admin@centre-ophtalmo.fr"; password = "admin123" }
$result = Test-Route -Name "Admin Login" -Url "$baseUrl/auth/login" -Method "POST" -Body $loginBody
if ($result.Success) { 
    $passed++
    $adminToken = $result.Data.data.access_token
    Write-Host "   Token obtained for admin" -ForegroundColor DarkGray
} else { $failed++ }

# Test 3: Login as Doctor
$loginBody = @{ email = "dr.martin@centre-ophtalmo.fr"; password = "doctor123" }
$result = Test-Route -Name "Doctor Login" -Url "$baseUrl/auth/login" -Method "POST" -Body $loginBody
if ($result.Success) { 
    $passed++
    $doctorToken = $result.Data.data.access_token
    Write-Host "   Token obtained for doctor" -ForegroundColor DarkGray
} else { $failed++ }

# Test 4: Verify Token
$result = Test-Route -Name "Verify Admin Token" -Url "$baseUrl/auth/verify" -Token $adminToken
if ($result.Success) { $passed++ } else { $failed++ }

# Test 5-7: Patient Routes (Admin)
Write-Host "`n--- PATIENTS (Admin) ---" -ForegroundColor Yellow
$result = Test-Route -Name "List Patients" -Url "$baseUrl/patients" -Token $adminToken
if ($result.Success) { 
    $passed++ 
    $patientCount = $result.Data.data.patients.Count
    Write-Host "   Found $patientCount patients" -ForegroundColor DarkGray
} else { $failed++ }

$result = Test-Route -Name "Search Patients" -Url "$baseUrl/patients?search=Jean" -Token $adminToken
if ($result.Success) { $passed++ } else { $failed++ }

# Get first patient ID
$patientsResult = Test-Route -Name "Get Patient Details" -Url "$baseUrl/patients/1" -Token $adminToken
if ($patientsResult.Success) { $passed++ } else { $failed++ }

# Test 8-10: Doctor Routes (Admin)
Write-Host "`n--- DOCTORS (Admin) ---" -ForegroundColor Yellow
$result = Test-Route -Name "List Doctors" -Url "$baseUrl/doctors" -Token $adminToken
if ($result.Success) { 
    $passed++ 
    $doctorCount = $result.Data.data.Count
    Write-Host "   Found $doctorCount doctors" -ForegroundColor DarkGray
} else { $failed++ }

$result = Test-Route -Name "Get Doctor Details" -Url "$baseUrl/doctors/2" -Token $adminToken
if ($result.Success) { $passed++ } else { $failed++ }

# Test 11-14: Doctor Dashboard Routes
Write-Host "`n--- DOCTOR DASHBOARD ---" -ForegroundColor Yellow
$result = Test-Route -Name "Doctor Stats" -Url "$baseUrl/doctor/stats" -Token $doctorToken
if ($result.Success) { 
    $passed++ 
    Write-Host "   Total exams: $($result.Data.data.total_exams)" -ForegroundColor DarkGray
} else { $failed++ }

$result = Test-Route -Name "Doctor Exams List" -Url "$baseUrl/doctor/exams" -Token $doctorToken
if ($result.Success) { $passed++ } else { $failed++ }

$result = Test-Route -Name "Doctor Exams with Filter" -Url "$baseUrl/doctor/exams?grade=3" -Token $doctorToken
if ($result.Success) { $passed++ } else { $failed++ }

# Test 15-17: Alerts Routes
Write-Host "`n--- ALERTS (Doctor) ---" -ForegroundColor Yellow
$result = Test-Route -Name "Alert Count" -Url "$baseUrl/doctor/alerts/count" -Token $doctorToken
if ($result.Success) { 
    $passed++ 
    Write-Host "   Unread: $($result.Data.data.unread)" -ForegroundColor DarkGray
} else { $failed++ }

$result = Test-Route -Name "List Unread Alerts" -Url "$baseUrl/doctor/alerts?status=unread" -Token $doctorToken
if ($result.Success) { $passed++ } else { $failed++ }

$result = Test-Route -Name "List All Alerts" -Url "$baseUrl/doctor/alerts?status=all" -Token $doctorToken
if ($result.Success) { $passed++ } else { $failed++ }

# Test 18: Unauthorized access
Write-Host "`n--- SECURITY TESTS ---" -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$baseUrl/patients" -Method GET -ErrorAction Stop
    Write-Host "[FAIL] Unauthorized Access - Should have been blocked" -ForegroundColor Red
    $failed++
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "[PASS] Unauthorized Access Blocked (401)" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "[FAIL] Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

# Test 19: Wrong credentials
$loginBody = @{ email = "wrong@email.com"; password = "wrongpass" }
try {
    Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body ($loginBody | ConvertTo-Json) -ContentType "application/json" -ErrorAction Stop
    Write-Host "[FAIL] Invalid Login - Should have been rejected" -ForegroundColor Red
    $failed++
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "[PASS] Invalid Credentials Rejected (401)" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "[FAIL] Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

# Test 20: Role-based access
try {
    Invoke-RestMethod -Uri "$baseUrl/doctor/stats" -Method GET -Headers @{ Authorization = "Bearer $adminToken" } -ErrorAction Stop
    Write-Host "[FAIL] Admin accessing Doctor route - Should have been blocked" -ForegroundColor Red
    $failed++
} catch {
    if ($_.Exception.Response.StatusCode -eq 403) {
        Write-Host "[PASS] Role-based Access Control (403)" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "[FAIL] Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  TEST RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Passed: $passed" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "  Total:  $($passed + $failed)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

if ($failed -eq 0) {
    Write-Host "All tests passed! The API is working correctly." -ForegroundColor Green
} else {
    Write-Host "$failed test(s) failed. Please review the errors above." -ForegroundColor Red
}
