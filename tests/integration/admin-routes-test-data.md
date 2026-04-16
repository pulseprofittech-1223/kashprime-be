# Admin Routes Integration Test Data

This document provides comprehensive test data for all admin routes in the KashPrime backend.

## Test Environment Setup

### Prerequisites
```javascript
// Base URL
const BASE_URL = 'http://localhost:5000/api/admin';

// Admin Authentication Token (required for most routes)
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Replace with actual admin JWT

// Sample User IDs (replace with actual UUIDs from your database)
const SAMPLE_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const SAMPLE_TRANSACTION_ID = '660e8400-e29b-41d4-a716-446655440001';

// Headers for authenticated requests
const authHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${ADMIN_TOKEN}`
};
```

---

## 1. PUBLIC ROUTES (No Authentication Required)

### 1.1 Get Top Earners Leaderboard

**Endpoint:** `GET /api/admin/leaderboard/top-earners`

**Test Case 1: Basic Request**
```http
GET /api/admin/leaderboard/top-earners
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Top earners retrieved successfully",
  "data": {
    "top_earners": [
      {
        "rank": 1,
        "username": "john_doe",
        "user_tier": "Pro",
        "current_balance": 125000.50,
        "other_balances": {
          "coins": 45000.00,
          "games": 30000.00,
          "investment": 50000.50
        }
      },
      {
        "rank": 2,
        "username": "jane_smith",
        "user_tier": "Amateur",
        "current_balance": 98500.75,
        "other_balances": {
          "coins": 35000.00,
          "games": 25000.75,
          "investment": 38500.00
        }
      }
      // ... up to 10 users
    ]
  }
}
```

---

## 2. USER MANAGEMENT ROUTES

### 2.1 Get All Users

**Endpoint:** `GET /api/admin/users`

**Test Case 1: Basic Request (Default Pagination)**
```http
GET /api/admin/users
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "john.doe@example.com",
        "username": "john_doe",
        "full_name": "John Doe",
        "phone_number": "+2348012345678",
        "country": "Nigeria",
        "user_tier": "Pro",
        "role": "user",
        "account_status": "active",
        "referral_code": "JOHN123",
        "decrypted_password": "SecurePass123!",
        "created_at": "2024-01-15T10:30:00Z",
        "last_login_at": "2024-11-27T15:45:00Z",
        "referred_by": null,
        "referrer": null,
        "wallets": [
          {
            "games_balance": 15000.00,
            "referral_balance": 45000.50,
            "investment_balance": 30000.00,
            "coins_balance": 25000.75,
            "total_withdrawn_games": 5000.00,
            "total_withdrawn_referral": 10000.00,
            "total_withdrawn_investment": 2000.00,
            "total_withdrawn_coins": 8000.00
          }
        ]
      }
      // ... more users
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_users": 100,
      "has_next": true,
      "has_prev": false,
      "limit": 20
    }
  }
}
```

**Test Case 2: Filtered by Role and Tier**
```http
GET /api/admin/users?role=user&user_tier=Pro&page=1&limit=10
Authorization: Bearer ${ADMIN_TOKEN}
```

**Test Case 3: Search by Name/Email**
```http
GET /api/admin/users?search=john&sort_by=created_at&sort_order=desc
Authorization: Bearer ${ADMIN_TOKEN}
```

**Test Case 4: Filter by Account Status**
```http
GET /api/admin/users?account_status=suspended&page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

**Test Case 5: Edge Case - Invalid Parameters**
```http
GET /api/admin/users?page=0&limit=200
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response (Error):**
```json
{
  "status": "error",
  "message": "Validation error",
  "errors": [
    {
      "field": "page",
      "message": "Page must be at least 1"
    },
    {
      "field": "limit",
      "message": "Limit must not exceed 100"
    }
  ]
}
```

---

### 2.2 Get User Details

**Endpoint:** `GET /api/admin/users/:userId`

**Test Case 1: Valid User ID**
```http
GET /api/admin/users/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "User details retrieved successfully",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john.doe@example.com",
      "username": "john_doe",
      "full_name": "John Doe",
      "phone_number": "+2348012345678",
      "country": "Nigeria",
      "user_tier": "Pro",
      "role": "user",
      "account_status": "active",
      "referral_code": "JOHN123",
      "decrypted_password": "SecurePass123!",
      "password": "$2b$10$...",
      "tiktok_handle": "@johndoe",
      "snapchat_handle": "johndoe_snap",
      "instagram_handle": "@johndoe_ig",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-11-27T12:00:00Z",
      "last_login_at": "2024-11-27T15:45:00Z",
      "referred_by": "440e8400-e29b-41d4-a716-446655440099",
      "referrer": {
        "id": "440e8400-e29b-41d4-a716-446655440099",
        "username": "referrer_user",
        "full_name": "Referrer User",
        "email": "referrer@example.com",
        "user_tier": "Pro",
        "role": "user",
        "decrypted_password": "ReferrerPass123!",
        "wallets": [
          {
            "referral_balance": 75000.00,
            "coins_balance": 50000.00
          }
        ]
      },
      "wallets": [
        {
          "id": "wallet-uuid-here",
          "user_id": "550e8400-e29b-41d4-a716-446655440000",
          "games_balance": 15000.00,
          "referral_balance": 45000.50,
          "investment_balance": 30000.00,
          "coins_balance": 25000.75,
          "total_withdrawn_games": 5000.00,
          "total_withdrawn_referral": 10000.00,
          "total_withdrawn_investment": 2000.00,
          "total_withdrawn_coins": 8000.00,
          "created_at": "2024-01-15T10:30:00Z",
          "updated_at": "2024-11-27T12:00:00Z"
        }
      ]
    },
    "referrer_info": {
      "id": "440e8400-e29b-41d4-a716-446655440099",
      "username": "referrer_user",
      "full_name": "Referrer User"
    },
    "referral_network": {
      "direct_referrals": [
        {
          "id": "user-id-1",
          "username": "direct_ref_1",
          "full_name": "Direct Referral 1",
          "user_tier": "Amateur",
          "email": "direct1@example.com",
          "decrypted_password": "DirectPass1!",
          "phone_number": "+2348011111111",
          "created_at": "2024-02-01T10:00:00Z",
          "level": "Direct (Level 1)",
          "wallets": [
            {
              "referral_balance": 12000.00,
              "coins_balance": 8000.00
            }
          ]
        }
      ],
      "tier1_referrals": [
        {
          "id": "user-id-2",
          "username": "tier1_ref_1",
          "full_name": "Tier 1 Referral 1",
          "user_tier": "Free",
          "email": "tier1@example.com",
          "decrypted_password": "Tier1Pass!",
          "level": "Tier 1 (Level 2)",
          "referred_by_username": "direct_ref_1",
          "wallets": [
            {
              "referral_balance": 5000.00,
              "coins_balance": 3000.00
            }
          ]
        }
      ],
      "tier2_referrals": []
    },
    "referral_stats": {
      "direct_count": 5,
      "tier1_count": 12,
      "tier2_count": 8,
      "total_network": 25,
      "breakdown": [
        {
          "package_type": "Pro",
          "direct_reward": 5000.00,
          "tier1_reward": 2500.00,
          "tier2_reward": 1000.00,
          "created_at": "2024-03-15T14:20:00Z"
        }
      ]
    },
    "summary": {
      "total_balance": 115000.75,
      "games_balance": 15000.00,
      "referral_balance": 45000.50,
      "investment_balance": 30000.00,
      "coins_balance": 25000.75,
      "total_withdrawn": 25000.00
    },
    "transactions": [
      {
        "id": "trans-id-1",
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "transaction_type": "withdrawal",
        "balance_type": "referral_balance",
        "amount": 5000.00,
        "currency": "NGN",
        "status": "completed",
        "reference": "WD-20241127-001",
        "description": "Withdrawal to bank account",
        "created_at": "2024-11-27T10:00:00Z"
      }
    ]
  }
}
```

**Test Case 2: Invalid User ID**
```http
GET /api/admin/users/invalid-uuid
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response (Error):**
```json
{
  "status": "error",
  "message": "Invalid user ID format"
}
```

**Test Case 3: Non-existent User**
```http
GET /api/admin/users/999e8400-e29b-41d4-a716-446655440000
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response (Error):**
```json
{
  "status": "error",
  "message": "User not found"
}
```

---

### 2.3 Get User Earnings (Admin)

**Endpoint:** `GET /api/admin/user/:userId/earnings`

**Test Case 1: Default (30 days)**
```http
GET /api/admin/user/550e8400-e29b-41d4-a716-446655440000/earnings
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "User earnings data retrieved successfully",
  "data": {
    "current_wallet": {
      "coins_balance": 25000.75,
      "games_balance": 15000.00,
      "referral_balance": 45000.50,
      "investment_balance": 30000.00,
      "total_withdrawn_games": 5000.00,
      "total_withdrawn_referral": 10000.00,
      "total_withdrawn_investment": 2000.00,
      "total_withdrawn_coins": 8000.00
    },
    "earnings_summary": {
      "all_time": {
        "total_earnings": 250000.00,
        "breakdown": {
          "referral_rewards": 85000.00,
          "tier1_rewards": 45000.00,
          "tier2_rewards": 25000.00,
          "game_wins": 50000.00,
          "investment_returns": 35000.00,
          "deposits": 10000.00,
          "other": 0.00
        },
        "transaction_count": 156
      },
      "recent_period": {
        "days": 30,
        "total_earnings": 45000.00,
        "transaction_count": 23
      }
    },
    "deductions_summary": {
      "all_time": {
        "total_deductions": 125000.00,
        "breakdown": {
          "withdrawals": 25000.00,
          "game_entries": 75000.00,
          "investments": 20000.00,
          "transfers": 3000.00,
          "purchases": 2000.00,
          "other": 0.00
        },
        "transaction_count": 89
      },
      "recent_period": {
        "days": 30,
        "total_deductions": 18000.00,
        "transaction_count": 12
      }
    },
    "net_summary": {
      "all_time_net": 125000.00,
      "recent_period_net": 27000.00
    },
    "referral_statistics": {
      "direct_referrals": 5,
      "tier1_referrals": 0,
      "tier2_referrals": 0,
      "total_referrals": 5
    },
    "recent_transactions": [
      {
        "id": "trans-id-1",
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "transaction_type": "reward",
        "earning_type": "referral_reward",
        "balance_type": "referral_balance",
        "amount": 5000.00,
        "currency": "NGN",
        "status": "completed",
        "created_at": "2024-11-25T14:30:00Z",
        "type_category": "credit"
      }
    ],
    "statistics": {
      "total_transactions": 245,
      "first_transaction_date": "2024-01-15T11:00:00Z",
      "last_transaction_date": "2024-11-27T15:45:00Z"
    }
  }
}
```

**Test Case 2: Custom Period (90 days)**
```http
GET /api/admin/user/550e8400-e29b-41d4-a716-446655440000/earnings?days=90
Authorization: Bearer ${ADMIN_TOKEN}
```

---

### 2.4 Update User Status

**Endpoint:** `PUT /api/admin/users/:userId/status`

**Test Case 1: Suspend User**
```http
PUT /api/admin/users/550e8400-e29b-41d4-a716-446655440000/status
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "account_status": "suspended"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "User updated successfully",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "john_doe",
      "email": "john.doe@example.com",
      "account_status": "suspended",
      "user_tier": "Pro",
      "role": "user",
      "updated_at": "2024-11-27T16:00:00Z"
    }
  }
}
```

**Test Case 2: Upgrade User Tier**
```http
PUT /api/admin/users/550e8400-e29b-41d4-a716-446655440000/status
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "user_tier": "Pro"
}
```

**Test Case 3: Change User Role**
```http
PUT /api/admin/users/550e8400-e29b-41d4-a716-446655440000/status
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "role": "manager"
}
```

**Test Case 4: Multiple Updates**
```http
PUT /api/admin/users/550e8400-e29b-41d4-a716-446655440000/status
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "account_status": "active",
  "user_tier": "Pro",
  "role": "merchant"
}
```

**Test Case 5: Invalid Status Value**
```http
PUT /api/admin/users/550e8400-e29b-41d4-a716-446655440000/status
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "account_status": "invalid_status"
}
```

**Expected Response (Error):**
```json
{
  "status": "error",
  "message": "Validation error",
  "errors": [
    {
      "field": "account_status",
      "message": "Invalid account status. Must be one of: active, suspended, banned"
    }
  ]
}
```

---

## 3. WITHDRAWAL MANAGEMENT ROUTES

### 3.1 Get Pending Withdrawals

**Endpoint:** `GET /api/admin/withdrawals/pending`

**Test Case 1: Basic Request**
```http
GET /api/admin/withdrawals/pending
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Pending withdrawals retrieved successfully",
  "data": {
    "withdrawals": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "amount": 15000.00,
        "currency": "NGN",
        "description": "Withdrawal to bank account",
        "reference": "WD-20241127-002",
        "withdrawal_method": "bank_transfer",
        "balance_type": "referral_balance",
        "created_at": "2024-11-27T14:30:00Z",
        "metadata": {
          "bank_name": "GTBank",
          "account_number": "0123456789",
          "account_name": "John Doe"
        },
        "users": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "username": "john_doe",
          "full_name": "John Doe",
          "email": "john.doe@example.com",
          "phone_number": "+2348012345678"
        }
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 3,
      "total_withdrawals": 45,
      "has_next": true,
      "has_prev": false,
      "limit": 20
    }
  }
}
```

**Test Case 2: With Search**
```http
GET /api/admin/withdrawals/pending?search=john&page=1&limit=10
Authorization: Bearer ${ADMIN_TOKEN}
```

**Test Case 3: Sorted by Amount**
```http
GET /api/admin/withdrawals/pending?sort_by=amount&sort_order=desc
Authorization: Bearer ${ADMIN_TOKEN}
```

---

### 3.2 Process Withdrawal (Approve/Decline)

**Endpoint:** `PUT /api/admin/withdrawals/:transactionId/process`

**Test Case 1: Approve Withdrawal (Referral Balance)**
```http
PUT /api/admin/withdrawals/660e8400-e29b-41d4-a716-446655440001/process
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "action": "approve"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Withdrawal approved successfully",
  "data": {
    "transactionId": "660e8400-e29b-41d4-a716-446655440001",
    "action": "approve",
    "amount": 15000.00,
    "username": "john_doe",
    "new_total_withdrawn": 25000.00,
    "balance_type": "referral_balance"
  }
}
```

**Test Case 2: Approve Withdrawal (Games Balance)**
```http
PUT /api/admin/withdrawals/770e8400-e29b-41d4-a716-446655440002/process
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "action": "approve"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Withdrawal approved successfully",
  "data": {
    "transactionId": "770e8400-e29b-41d4-a716-446655440002",
    "action": "approve",
    "amount": 5000.00,
    "username": "john_doe",
    "new_total_withdrawn": 10000.00,
    "balance_type": "games_balance"
  }
}
```

**Test Case 3: Decline Withdrawal (With Reason)**
```http
PUT /api/admin/withdrawals/660e8400-e29b-41d4-a716-446655440001/process
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "action": "decline",
  "decline_reason": "Invalid bank account details provided"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Withdrawal declined successfully and amount refunded to user",
  "data": {
    "transactionId": "660e8400-e29b-41d4-a716-446655440001",
    "action": "decline",
    "amount": 15000.00,
    "username": "john_doe",
    "decline_reason": "Invalid bank account details provided",
    "balance_type": "referral_balance",
    "new_balance": 60000.50
  }
}
```

**Test Case 4: Decline Withdrawal (No Reason)**
```http
PUT /api/admin/withdrawals/660e8400-e29b-41d4-a716-446655440001/process
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "action": "decline"
}
```

**Test Case 5: Invalid Action**
```http
PUT /api/admin/withdrawals/660e8400-e29b-41d4-a716-446655440001/process
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "action": "cancel"
}
```

**Expected Response (Error):**
```json
{
  "status": "error",
  "message": "Invalid action. Must be \"approve\" or \"decline\""
}
```

**Test Case 6: Already Processed Transaction**
```http
PUT /api/admin/withdrawals/660e8400-e29b-41d4-a716-446655440001/process
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "action": "approve"
}
```

**Expected Response (Error):**
```json
{
  "status": "error",
  "message": "Transaction not found or already processed"
}
```

---

### 3.3 Bulk Process Withdrawals

**Endpoint:** `PUT /api/admin/withdrawals/bulk-process`

**Test Case 1: Bulk Approve (Mixed Balance Types)**
```http
PUT /api/admin/withdrawals/bulk-process
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "transaction_ids": [
    "660e8400-e29b-41d4-a716-446655440001",
    "770e8400-e29b-41d4-a716-446655440002",
    "880e8400-e29b-41d4-a716-446655440003"
  ],
  "action": "approve"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Bulk approve completed successfully",
  "data": {
    "processed_count": 3,
    "failed_count": 0,
    "total_requested": 3,
    "total_amount": 35000.00,
    "processed_ids": [
      "660e8400-e29b-41d4-a716-446655440001",
      "770e8400-e29b-41d4-a716-446655440002",
      "880e8400-e29b-41d4-a716-446655440003"
    ],
    "failed_ids": []
  }
}
```

**Test Case 2: Bulk Decline (With Reason)**
```http
PUT /api/admin/withdrawals/bulk-process
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "transaction_ids": [
    "990e8400-e29b-41d4-a716-446655440004",
    "aa0e8400-e29b-41d4-a716-446655440005"
  ],
  "action": "decline",
  "decline_reason": "Bulk decline for verification purposes"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Bulk decline completed successfully and amounts refunded to users",
  "data": {
    "processed_count": 2,
    "failed_count": 0,
    "total_requested": 2,
    "total_amount": 25000.00,
    "processed_ids": [
      "990e8400-e29b-41d4-a716-446655440004",
      "aa0e8400-e29b-41d4-a716-446655440005"
    ],
    "failed_ids": []
  }
}
```

**Test Case 3: Partial Success (Some Already Processed)**
```http
PUT /api/admin/withdrawals/bulk-process
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "transaction_ids": [
    "660e8400-e29b-41d4-a716-446655440001",
    "bb0e8400-e29b-41d4-a716-446655440006",
    "cc0e8400-e29b-41d4-a716-446655440007"
  ],
  "action": "approve"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Bulk approve completed with some failures",
  "data": {
    "processed_count": 2,
    "failed_count": 1,
    "total_requested": 3,
    "total_amount": 20000.00,
    "processed_ids": [
      "bb0e8400-e29b-41d4-a716-446655440006",
      "cc0e8400-e29b-41d4-a716-446655440007"
    ],
    "failed_ids": [
      "660e8400-e29b-41d4-a716-446655440001"
    ]
  }
}
```

**Test Case 4: Too Many Transactions**
```http
PUT /api/admin/withdrawals/bulk-process
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "transaction_ids": [
    // ... 51 transaction IDs
  ],
  "action": "approve"
}
```

**Expected Response (Error):**
```json
{
  "status": "error",
  "message": "Cannot process more than 50 transactions at once"
}
```

**Test Case 5: Empty Array**
```http
PUT /api/admin/withdrawals/bulk-process
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "transaction_ids": [],
  "action": "approve"
}
```

**Expected Response (Error):**
```json
{
  "status": "error",
  "message": "Invalid transaction IDs provided"
}
```

---

### 3.4 Get Withdrawal Statistics

**Endpoint:** `GET /api/admin/withdrawals/statistics`

**Test Case 1: Basic Request**
```http
GET /api/admin/withdrawals/statistics
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Withdrawal statistics retrieved successfully",
  "data": {
    "pending": {
      "count": 45,
      "total_amount": 675000.00
    },
    "completed": {
      "count": 234,
      "total_amount": 3500000.00
    },
    "cancelled": {
      "count": 12,
      "total_amount": 180000.00
    }
  }
}
```

---

## 4. KASHCOIN/COINS MANAGEMENT ROUTES

### 4.1 Get Eligible Users for Coins Withdrawal

**Endpoint:** `GET /api/admin/kashcoin/eligible-users`

**Test Case 1: Basic Request**
```http
GET /api/admin/kashcoin/eligible-users
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Eligible users retrieved successfully",
  "data": {
    "users": [
      {
        "coins_balance": 65000.50,
        "users": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "username": "john_doe",
          "full_name": "John Doe",
          "email": "john.doe@example.com",
          "phone_number": "+2348012345678",
          "created_at": "2024-01-15T10:30:00Z"
        }
      },
      {
        "coins_balance": 52000.75,
        "users": {
          "id": "440e8400-e29b-41d4-a716-446655440099",
          "username": "jane_smith",
          "full_name": "Jane Smith",
          "email": "jane.smith@example.com",
          "phone_number": "+2348087654321",
          "created_at": "2024-02-10T14:20:00Z"
        }
      }
    ],
    "threshold": 40000.00,
    "pagination": {
      "current_page": 1,
      "total_pages": 2,
      "total_users": 28,
      "has_next": true,
      "has_prev": false,
      "limit": 20
    }
  }
}
```

**Test Case 2: With Search**
```http
GET /api/admin/kashcoin/eligible-users?search=john&page=1&limit=10
Authorization: Bearer ${ADMIN_TOKEN}
```

**Test Case 3: Sorted by Balance (Descending)**
```http
GET /api/admin/kashcoin/eligible-users?sort_by=coins_balance&sort_order=desc
Authorization: Bearer ${ADMIN_TOKEN}
```

---

## 5. SETTINGS MANAGEMENT ROUTES

### 5.1 Get All Settings

**Endpoint:** `GET /api/admin/settings`

**Test Case 1: Basic Request**
```http
GET /api/admin/settings
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Settings retrieved successfully",
  "data": {
    "settings": [
      {
        "id": "setting-id-1",
        "setting_key": "coins_withdrawal_threshold",
        "setting_value": "40000",
        "description": "Minimum coins balance required for withdrawal",
        "updated_by": "admin-user-id",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-11-15T10:30:00Z"
      },
      {
        "id": "setting-id-2",
        "setting_key": "referral_withdrawal_threshold_free",
        "setting_value": "30000",
        "description": "Minimum referral balance for Free tier withdrawal",
        "updated_by": "admin-user-id",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-11-20T14:00:00Z"
      },
      {
        "id": "setting-id-3",
        "setting_key": "referral_withdrawal_threshold_pro",
        "setting_value": "15000",
        "description": "Minimum referral balance for Pro tier withdrawal",
        "updated_by": "admin-user-id",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-11-20T14:00:00Z"
      },
      {
        "id": "setting-id-4",
        "setting_key": "games_withdrawal_threshold",
        "setting_value": "1000",
        "description": "Minimum games balance for withdrawal",
        "updated_by": "admin-user-id",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-11-10T09:00:00Z"
      },
      {
        "id": "setting-id-5",
        "setting_key": "investment_withdrawal_threshold",
        "setting_value": "3500",
        "description": "Minimum investment balance for withdrawal",
        "updated_by": "admin-user-id",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-11-10T09:00:00Z"
      },
      {
        "id": "setting-id-6",
        "setting_key": "tier_upgrade_cost",
        "setting_value": "2500",
        "description": "Cost to upgrade from Free to Pro tier",
        "updated_by": "admin-user-id",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-10-01T12:00:00Z"
      },
      {
        "id": "setting-id-7",
        "setting_key": "upcoming_payout_date",
        "setting_value": "2024-12-15",
        "description": "Next scheduled payout date",
        "updated_by": "admin-user-id",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-11-27T16:00:00Z"
      }
    ]
  }
}
```

---

### 5.2 Update Setting

**Endpoint:** `PUT /api/admin/settings`

**Test Case 1: Update Coins Threshold**
```http
PUT /api/admin/settings
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "setting_key": "coins_withdrawal_threshold",
  "setting_value": "45000"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Setting updated successfully",
  "data": {
    "setting": {
      "id": "setting-id-1",
      "setting_key": "coins_withdrawal_threshold",
      "setting_value": "45000",
      "description": "Minimum coins balance required for withdrawal",
      "updated_by": "admin-user-id",
      "updated_at": "2024-11-27T16:30:00Z"
    }
  }
}
```

**Test Case 2: Update Payout Date**
```http
PUT /api/admin/settings
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "setting_key": "upcoming_payout_date",
  "setting_value": "2024-12-20"
}
```

**Test Case 3: Update Tier Upgrade Cost**
```http
PUT /api/admin/settings
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "setting_key": "tier_upgrade_cost",
  "setting_value": "3000"
}
```

**Test Case 4: Invalid Setting Key**
```http
PUT /api/admin/settings
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "setting_key": "",
  "setting_value": "5000"
}
```

**Expected Response (Error):**
```json
{
  "status": "error",
  "message": "Validation error",
  "errors": [
    {
      "field": "setting_key",
      "message": "Setting key is required"
    }
  ]
}
```

---

## 6. DASHBOARD ROUTES

### 6.1 Get Dashboard Statistics

**Endpoint:** `GET /api/admin/dashboard/stats`

**Test Case 1: Basic Request**
```http
GET /api/admin/dashboard/stats
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Dashboard stats retrieved successfully",
  "data": {
    "stats": {
      "users": {
        "total": 1250,
        "by_tier": {
          "Amateur": 450,
          "Pro": 800
        },
        "by_role": {
          "user": 1200,
          "merchant": 35,
          "manager": 15
        },
        "active": 1180,
        "suspended": 70
      },
      "revenue": {
        "total_generated": 14250000.00,
        "amateur_revenue": 4275000.00,
        "pro_revenue": 9975000.00,
        "amateur_codes_used": 450,
        "pro_codes_used": 665
      },
      "codes": {
        "total_generated": 2000,
        "amateur_codes": 800,
        "pro_codes": 1200,
        "total_used": 1115,
        "total_unused": 885
      },
      "kashskit": {
        "total_videos_uploaded": 3456
      },
      "balance_growth": {
        "total_games_balance": 2500000.00,
        "total_referral_balance": 8750000.50,
        "total_investment_balance": 5250000.00,
        "total_coins_balance": 3125000.75,
        "combined_balance": 19625000.25
      },
      "transactions": {
        "total_30_days": 5678,
        "by_type": {
          "withdrawal": 234,
          "deposit": 456,
          "reward": 3890,
          "transfer": 1098
        }
      },
      "withdrawals": {
        "pending_count": 45,
        "pending_amount": 675000.00
      },
      "recent_users": [
        {
          "id": "user-id-1",
          "username": "new_user_1",
          "full_name": "New User One",
          "email": "newuser1@example.com",
          "user_tier": "Free",
          "created_at": "2024-11-27T15:30:00Z"
        }
        // ... up to 10 recent users
      ],
      "platform_info": {
        "upcoming_payout_date": "2024-12-15"
      }
    }
  }
}
```

---

## 7. ERROR SCENARIOS

### 7.1 Unauthorized Access (No Token)

```http
GET /api/admin/users
```

**Expected Response:**
```json
{
  "status": "error",
  "message": "No authorization token provided"
}
```

### 7.2 Invalid Token

```http
GET /api/admin/users
Authorization: Bearer invalid_token_here
```

**Expected Response:**
```json
{
  "status": "error",
  "message": "Invalid or expired token"
}
```

### 7.3 Non-Admin User

```http
GET /api/admin/users
Authorization: Bearer ${USER_TOKEN}
```

**Expected Response:**
```json
{
  "status": "error",
  "message": "Access denied. Admin privileges required."
}
```

### 7.4 Rate Limit Exceeded

```http
// After 100 requests within 15 minutes
GET /api/admin/users
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "error",
  "message": "Too many requests from this IP, please try again later."
}
```

---

## 8. TESTING TOOLS & SCRIPTS

### 8.1 Postman Collection

Import the following environment variables:
```json
{
  "base_url": "http://localhost:5000/api/admin",
  "admin_token": "your_admin_jwt_token",
  "sample_user_id": "550e8400-e29b-41d4-a716-446655440000",
  "sample_transaction_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

### 8.2 cURL Examples

**Get All Users:**
```bash
curl -X GET "http://localhost:5000/api/admin/users?page=1&limit=20" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json"
```

**Approve Withdrawal:**
```bash
curl -X PUT "http://localhost:5000/api/admin/withdrawals/${TRANSACTION_ID}/process" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"action": "approve"}'
```

**Bulk Decline Withdrawals:**
```bash
curl -X PUT "http://localhost:5000/api/admin/withdrawals/bulk-process" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_ids": ["id1", "id2", "id3"],
    "action": "decline",
    "decline_reason": "Test decline"
  }'
```

### 8.3 JavaScript/Node.js Test Script

```javascript
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/admin';
const ADMIN_TOKEN = 'your_admin_jwt_token';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Test: Get all users
async function testGetAllUsers() {
  try {
    const response = await api.get('/users', {
      params: { page: 1, limit: 10 }
    });
    console.log('✅ Get All Users:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Test: Approve withdrawal
async function testApproveWithdrawal(transactionId) {
  try {
    const response = await api.put(`/withdrawals/${transactionId}/process`, {
      action: 'approve'
    });
    console.log('✅ Approve Withdrawal:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Run tests
(async () => {
  await testGetAllUsers();
  await testApproveWithdrawal('660e8400-e29b-41d4-a716-446655440001');
})();
```

---

## 9. INTEGRATION TEST CHECKLIST

- [ ] **Authentication**
  - [ ] Valid admin token works
  - [ ] Invalid token is rejected
  - [ ] Non-admin user is rejected
  - [ ] Missing token is rejected

- [ ] **User Management**
  - [ ] Get all users with default pagination
  - [ ] Filter users by role, tier, status
  - [ ] Search users by name/email
  - [ ] Get user details with full referral network
  - [ ] Update user status/tier/role
  - [ ] Get user earnings breakdown

- [ ] **Withdrawal Processing**
  - [ ] Get pending withdrawals
  - [ ] Approve withdrawal (games_balance)
  - [ ] Approve withdrawal (referral_balance)
  - [ ] Approve withdrawal (investment_balance)
  - [ ] Approve withdrawal (coins_balance)
  - [ ] Decline withdrawal with refund
  - [ ] Bulk approve multiple withdrawals
  - [ ] Bulk decline multiple withdrawals
  - [ ] Handle already processed transactions

- [ ] **Coins Management**
  - [ ] Get eligible users above threshold
  - [ ] Search eligible users
  - [ ] Sort by balance

- [ ] **Settings**
  - [ ] Get all settings
  - [ ] Update withdrawal thresholds
  - [ ] Update payout date

- [ ] **Dashboard**
  - [ ] Get comprehensive dashboard stats
  - [ ] Verify balance calculations
  - [ ] Check recent users list

- [ ] **Error Handling**
  - [ ] Invalid UUIDs
  - [ ] Non-existent resources
  - [ ] Validation errors
  - [ ] Rate limiting

---

## 10. NOTES

1. **Replace Sample IDs**: All UUIDs in this document are samples. Replace them with actual IDs from your database.

2. **Balance Types**: The system supports 4 balance types:
   - `games_balance`
   - `referral_balance`
   - `investment_balance`
   - `coins_balance`

3. **Withdrawal Processing**: Each withdrawal is tied to a specific `balance_type`. When approved, the corresponding `total_withdrawn_{type}` field is updated. When declined, the amount is refunded to the source balance.

4. **Rate Limiting**: Admin routes allow 100 requests per 15 minutes. Public routes allow 50 requests per 15 minutes.

5. **Pagination**: Default page size is 20, maximum is 100.

6. **Authentication**: All routes except public leaderboards require admin authentication.

---

## 11. GAMING ADMIN ROUTES

### 11.1 Coinflip Admin Statistics

**Endpoint:** `GET /api/coinflip/admin/statistics`

**Test Case 1: Get Comprehensive Game Statistics**
```http
GET /api/coinflip/admin/statistics
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Admin statistics retrieved successfully",
  "data": {
    "total_games": 15234,
    "total_wagered": 45678000.00,
    "total_won": 22345000.00,
    "total_lost": 23333000.00,
    "house_profit": 1000000.00,
    "active_players_24h": 456,
    "active_players_7d": 1234,
    "average_bet_size": 3000.00,
    "win_rate": 48.9,
    "games_by_outcome": {
      "heads": 7650,
      "tails": 7584
    },
    "top_winners": [
      {
        "username": "lucky_player",
        "total_won": 125000.00,
        "games_played": 234
      }
    ],
    "recent_games": [
      {
        "id": "game-uuid",
        "username": "player1",
        "bet_amount": 5000.00,
        "choice": "heads",
        "result": "heads",
        "payout": 9500.00,
        "created_at": "2024-11-28T01:00:00Z"
      }
    ]
  }
}
```

---

### 11.2 Mines Admin Statistics

**Endpoint:** `GET /api/mines/admin/statistics`

**Test Case 1: Get Mines Game Statistics**
```http
GET /api/mines/admin/statistics
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Admin statistics retrieved successfully",
  "data": {
    "total_games": 8456,
    "total_wagered": 25678000.00,
    "total_won": 12345000.00,
    "total_lost": 13333000.00,
    "house_profit": 988000.00,
    "active_players_24h": 234,
    "active_players_7d": 789,
    "average_bet_size": 3038.00,
    "cashout_rate": 65.5,
    "bomb_hit_rate": 34.5,
    "average_multiplier": 2.15,
    "games_by_difficulty": {
      "easy": 3456,
      "medium": 3000,
      "hard": 2000
    },
    "top_multipliers": [
      {
        "username": "risk_taker",
        "multiplier": 15.5,
        "bet_amount": 1000.00,
        "payout": 15500.00,
        "created_at": "2024-11-27T20:00:00Z"
      }
    ]
  }
}
```

---

## 12. INVESTMENT ADMIN ROUTES

### 12.1 Get All Investments (Admin)

**Endpoint:** `GET /api/investments/admin/all`

**Test Case 1: Get All Investments with Pagination**
```http
GET /api/investments/admin/all?page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "All investments retrieved successfully",
  "data": {
    "investments": [
      {
        "id": "inv-uuid-1",
        "user_id": "user-uuid",
        "username": "investor1",
        "full_name": "John Investor",
        "plan_name": "pro",
        "amount": 50000.00,
        "expected_return": 7500.00,
        "total_paid_out": 3750.00,
        "remaining_balance": 3750.00,
        "status": "active",
        "start_date": "2024-11-01T00:00:00Z",
        "end_date": "2024-12-29T23:59:59Z",
        "weeks_remaining": 4,
        "created_at": "2024-11-01T10:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_investments": 95,
      "has_next": true,
      "has_prev": false,
      "limit": 20
    }
  }
}
```

**Test Case 2: Filter by Status**
```http
GET /api/investments/admin/all?status=active&page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

**Test Case 3: Search by Username**
```http
GET /api/investments/admin/all?search=john&page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

---

### 12.2 Get Investment Statistics (Admin)

**Endpoint:** `GET /api/investments/admin/stats`

**Test Case 1: Get Comprehensive Investment Stats**
```http
GET /api/investments/admin/stats
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Investment statistics retrieved successfully",
  "data": {
    "total_investments": 95,
    "active_investments": 67,
    "completed_investments": 28,
    "total_capital_invested": 4750000.00,
    "total_returns_paid": 712500.00,
    "pending_returns": 237500.00,
    "by_plan": {
      "starter": {
        "count": 15,
        "total_amount": 375000.00
      },
      "amateur": {
        "count": 25,
        "total_amount": 1250000.00
      },
      "pro": {
        "count": 35,
        "total_amount": 1750000.00
      },
      "master": {
        "count": 20,
        "total_amount": 1375000.00
      }
    },
    "upcoming_payouts": {
      "this_week": 125000.00,
      "next_week": 130000.00
    },
    "recent_investments": [
      {
        "username": "new_investor",
        "plan_name": "pro",
        "amount": 50000.00,
        "created_at": "2024-11-27T15:00:00Z"
      }
    ]
  }
}
```

---

### 12.3 Process Weekly Payouts (Admin)

**Endpoint:** `POST /api/investments/admin/process-payouts`

**Test Case 1: Manually Trigger Weekly Payouts**
```http
POST /api/investments/admin/process-payouts
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Weekly payouts processed successfully",
  "data": {
    "processed_count": 67,
    "total_amount_paid": 125000.00,
    "failed_count": 0,
    "processed_investments": [
      {
        "investment_id": "inv-uuid-1",
        "user_id": "user-uuid",
        "username": "investor1",
        "payout_amount": 1875.00,
        "new_balance": 51875.00
      }
    ],
    "processing_time": "2.5s"
  }
}
```

---

### 12.4 Get Pending Investment Withdrawals (Admin)

**Endpoint:** `GET /api/investments/admin/withdrawals/pending`

**Test Case 1: Get Pending Investment Withdrawals**
```http
GET /api/investments/admin/withdrawals/pending?page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Pending investment withdrawals retrieved successfully",
  "data": {
    "withdrawals": [
      {
        "id": "trans-uuid",
        "user_id": "user-uuid",
        "username": "investor1",
        "full_name": "John Investor",
        "amount": 25000.00,
        "balance_type": "investment_balance",
        "withdrawal_method": "bank_transfer",
        "bank_details": {
          "bank_name": "GTBank",
          "account_number": "0123456789",
          "account_name": "John Investor"
        },
        "created_at": "2024-11-27T14:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 2,
      "total_withdrawals": 23,
      "has_next": true,
      "has_prev": false,
      "limit": 20
    }
  }
}
```

---

### 12.5 Process Investment Withdrawal (Admin)

**Endpoint:** `PUT /api/investments/admin/withdrawals/:transactionId/process`

**Test Case 1: Approve Investment Withdrawal**
```http
PUT /api/investments/admin/withdrawals/trans-uuid/process
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "action": "approve"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Investment withdrawal approved successfully",
  "data": {
    "transaction_id": "trans-uuid",
    "user_id": "user-uuid",
    "username": "investor1",
    "amount": 25000.00,
    "balance_type": "investment_balance",
    "new_total_withdrawn": 50000.00
  }
}
```

**Test Case 2: Decline Investment Withdrawal**
```http
PUT /api/investments/admin/withdrawals/trans-uuid/process
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "action": "decline",
  "decline_reason": "Insufficient documentation"
}
```

---

### 12.6 Bulk Process Investment Withdrawals (Admin)

**Endpoint:** `PUT /api/investments/admin/withdrawals/bulk-process`

**Test Case 1: Bulk Approve Investment Withdrawals**
```http
PUT /api/investments/admin/withdrawals/bulk-process
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "transaction_ids": [
    "trans-uuid-1",
    "trans-uuid-2",
    "trans-uuid-3"
  ],
  "action": "approve"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Bulk approve completed successfully",
  "data": {
    "processed_count": 3,
    "failed_count": 0,
    "total_requested": 3,
    "total_amount": 75000.00,
    "processed_ids": [
      "trans-uuid-1",
      "trans-uuid-2",
      "trans-uuid-3"
    ],
    "failed_ids": []
  }
}
```

---

## 13. SOCIAL MEDIA BOOST ADMIN ROUTES

### 13.1 Get All Boost Applications (Admin)

**Endpoint:** `GET /api/social/admin/applications`

**Test Case 1: Get All Applications**
```http
GET /api/social/admin/applications?page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Boost applications retrieved successfully",
  "data": {
    "applications": [
      {
        "id": "app-uuid-1",
        "user_id": "user-uuid",
        "username": "influencer1",
        "full_name": "Jane Influencer",
        "platform": "tiktok",
        "social_username": "@janedoe",
        "phone_number": "+2348012345678",
        "current_followers": 5000,
        "desired_followers": 10000,
        "status": "pending",
        "admin_notes": null,
        "created_at": "2024-11-27T10:00:00Z",
        "updated_at": "2024-11-27T10:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 3,
      "total_applications": 45,
      "has_next": true,
      "has_prev": false,
      "limit": 20
    }
  }
}
```

**Test Case 2: Filter by Platform and Status**
```http
GET /api/social/admin/applications?platform=tiktok&status=pending&page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

**Test Case 3: Search by Username**
```http
GET /api/social/admin/applications?search=jane&page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

---

### 13.2 Review Boost Application (Admin)

**Endpoint:** `PUT /api/social/admin/review/:id`

**Test Case 1: Approve Application**
```http
PUT /api/social/admin/review/app-uuid-1
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "status": "approved",
  "adminNotes": "Verified account, approved for boost"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Application reviewed successfully",
  "data": {
    "application": {
      "id": "app-uuid-1",
      "user_id": "user-uuid",
      "username": "influencer1",
      "platform": "tiktok",
      "status": "approved",
      "admin_notes": "Verified account, approved for boost",
      "reviewed_at": "2024-11-28T01:00:00Z",
      "reviewed_by": "admin-uuid"
    }
  }
}
```

**Test Case 2: Decline Application**
```http
PUT /api/social/admin/review/app-uuid-1
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "status": "declined",
  "adminNotes": "Account does not meet minimum follower requirements"
}
```

**Test Case 3: Mark as Completed**
```http
PUT /api/social/admin/review/app-uuid-1
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "status": "completed",
  "adminNotes": "Boost campaign completed successfully"
}
```

---

### 13.3 Get Boost Statistics (Admin)

**Endpoint:** `GET /api/social/admin/statistics`

**Test Case 1: Get Comprehensive Boost Stats**
```http
GET /api/social/admin/statistics
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Boost statistics retrieved successfully",
  "data": {
    "total_applications": 156,
    "by_status": {
      "pending": 45,
      "approved": 67,
      "declined": 23,
      "completed": 21
    },
    "by_platform": {
      "tiktok": 89,
      "instagram": 45,
      "snapchat": 22
    },
    "average_current_followers": 3500,
    "average_desired_followers": 8500,
    "approval_rate": 74.3,
    "completion_rate": 31.3,
    "recent_applications": [
      {
        "username": "new_influencer",
        "platform": "tiktok",
        "current_followers": 2000,
        "desired_followers": 5000,
        "status": "pending",
        "created_at": "2024-11-27T20:00:00Z"
      }
    ]
  }
}
```

---

### 13.4 Bulk Delete Applications (Admin)

**Endpoint:** `DELETE /api/social/admin/bulk-delete`

**Test Case 1: Bulk Delete Applications**
```http
DELETE /api/social/admin/bulk-delete
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "applicationIds": [
    "app-uuid-1",
    "app-uuid-2",
    "app-uuid-3"
  ],
  "action": "delete"
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Applications deleted successfully",
  "data": {
    "deleted_count": 3,
    "deleted_ids": [
      "app-uuid-1",
      "app-uuid-2",
      "app-uuid-3"
    ]
  }
}
```

---

## 14. SPONSORED POSTS ADMIN ROUTES

### 14.1 Create Sponsored Post (Admin)

**Endpoint:** `POST /api/sponsored-posts/admin`

**Test Case 1: Create New Sponsored Post**
```http
POST /api/sponsored-posts/admin
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: multipart/form-data

{
  "title": "Amazing Product Launch",
  "content": "Check out our new product with exclusive discount!",
  "link": "https://example.com/product",
  "reward_amount": 50,
  "max_engagements": 1000,
  "is_published": true,
  "featured_image": <file>
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Sponsored post created successfully",
  "data": {
    "post": {
      "id": "post-uuid",
      "title": "Amazing Product Launch",
      "content": "Check out our new product with exclusive discount!",
      "link": "https://example.com/product",
      "reward_amount": 50.00,
      "max_engagements": 1000,
      "current_engagements": 0,
      "is_published": true,
      "featured_image_url": "https://cdn.example.com/images/post-uuid.jpg",
      "created_by": "admin-uuid",
      "created_at": "2024-11-28T01:00:00Z"
    }
  }
}
```

---

### 14.2 Get All Sponsored Posts (Admin)

**Endpoint:** `GET /api/sponsored-posts/admin/all`

**Test Case 1: Get All Posts with Pagination**
```http
GET /api/sponsored-posts/admin/all?page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "All sponsored posts retrieved successfully",
  "data": {
    "posts": [
      {
        "id": "post-uuid",
        "title": "Amazing Product Launch",
        "content": "Check out our new product...",
        "link": "https://example.com/product",
        "reward_amount": 50.00,
        "max_engagements": 1000,
        "current_engagements": 456,
        "is_published": true,
        "featured_image_url": "https://cdn.example.com/images/post-uuid.jpg",
        "created_by": "admin-uuid",
        "created_at": "2024-11-25T10:00:00Z",
        "updated_at": "2024-11-27T15:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 2,
      "total_posts": 23,
      "has_next": true,
      "has_prev": false,
      "limit": 20
    }
  }
}
```

**Test Case 2: Filter by Published Status**
```http
GET /api/sponsored-posts/admin/all?is_published=true&page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

---

### 14.3 Update Sponsored Post (Admin)

**Endpoint:** `PUT /api/sponsored-posts/admin/:id`

**Test Case 1: Update Post Details**
```http
PUT /api/sponsored-posts/admin/post-uuid
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: application/json

{
  "title": "Updated Product Launch",
  "reward_amount": 75,
  "is_published": false
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Sponsored post updated successfully",
  "data": {
    "post": {
      "id": "post-uuid",
      "title": "Updated Product Launch",
      "reward_amount": 75.00,
      "is_published": false,
      "updated_at": "2024-11-28T01:00:00Z"
    }
  }
}
```

---

### 14.4 Delete Sponsored Post (Admin)

**Endpoint:** `DELETE /api/sponsored-posts/admin/:id`

**Test Case 1: Delete Post**
```http
DELETE /api/sponsored-posts/admin/post-uuid
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Sponsored post deleted successfully",
  "data": {
    "deleted_id": "post-uuid"
  }
}
```

---

## 15. KASHSKIT ADMIN ROUTES

### 15.1 Upload KashSkit Video (Admin)

**Endpoint:** `POST /api/kashskit/admin/upload`

**Test Case 1: Upload New Video**
```http
POST /api/kashskit/admin/upload
Authorization: Bearer ${ADMIN_TOKEN}
Content-Type: multipart/form-data

{
  "skit_title": "Funny Comedy Skit #1",
  "creator": "Comedy King",
  "external_link": "https://youtube.com/watch?v=example",
  "video": <file>
}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Video uploaded successfully",
  "data": {
    "video": {
      "id": "video-uuid",
      "skit_title": "Funny Comedy Skit #1",
      "creator": "Comedy King",
      "external_link": "https://youtube.com/watch?v=example",
      "video_url": "https://cdn.example.com/videos/video-uuid.mp4",
      "thumbnail_url": "https://cdn.example.com/thumbnails/video-uuid.jpg",
      "duration": 120,
      "file_size": 15728640,
      "is_active": true,
      "total_claims": 0,
      "uploaded_by": "admin-uuid",
      "created_at": "2024-11-28T01:00:00Z"
    }
  }
}
```

---

### 15.2 Get All Videos (Admin)

**Endpoint:** `GET /api/kashskit/admin/videos`

**Test Case 1: Get All Videos with Pagination**
```http
GET /api/kashskit/admin/videos?page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "All videos retrieved successfully",
  "data": {
    "videos": [
      {
        "id": "video-uuid",
        "skit_title": "Funny Comedy Skit #1",
        "creator": "Comedy King",
        "video_url": "https://cdn.example.com/videos/video-uuid.mp4",
        "thumbnail_url": "https://cdn.example.com/thumbnails/video-uuid.jpg",
        "duration": 120,
        "is_active": true,
        "total_claims": 456,
        "unique_viewers": 234,
        "total_rewards_paid": 22800.00,
        "created_at": "2024-11-20T10:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_videos": 89,
      "has_next": true,
      "has_prev": false,
      "limit": 20
    }
  }
}
```

**Test Case 2: Filter by Active Status**
```http
GET /api/kashskit/admin/videos?is_active=true&page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

**Test Case 3: Search by Title**
```http
GET /api/kashskit/admin/videos?search=comedy&page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

---

### 15.3 Get Video Details (Admin)

**Endpoint:** `GET /api/kashskit/admin/videos/:videoId`

**Test Case 1: Get Detailed Video Statistics**
```http
GET /api/kashskit/admin/videos/video-uuid
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Video details retrieved successfully",
  "data": {
    "video": {
      "id": "video-uuid",
      "skit_title": "Funny Comedy Skit #1",
      "creator": "Comedy King",
      "external_link": "https://youtube.com/watch?v=example",
      "video_url": "https://cdn.example.com/videos/video-uuid.mp4",
      "thumbnail_url": "https://cdn.example.com/thumbnails/video-uuid.jpg",
      "duration": 120,
      "file_size": 15728640,
      "is_active": true,
      "created_at": "2024-11-20T10:00:00Z"
    },
    "statistics": {
      "total_claims": 456,
      "unique_viewers": 234,
      "total_rewards_paid": 22800.00,
      "average_claims_per_day": 65,
      "claims_by_date": [
        {
          "date": "2024-11-27",
          "claims": 78
        },
        {
          "date": "2024-11-26",
          "claims": 65
        }
      ],
      "top_claimers": [
        {
          "username": "frequent_viewer",
          "claims": 5,
          "total_earned": 250.00
        }
      ]
    }
  }
}
```

---

### 15.4 Delete Video (Admin)

**Endpoint:** `DELETE /api/kashskit/admin/videos/:videoId`

**Test Case 1: Delete Video**
```http
DELETE /api/kashskit/admin/videos/video-uuid
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Video deleted successfully",
  "data": {
    "deleted_id": "video-uuid",
    "total_claims_affected": 456
  }
}
```

---

## 16. PAYMENTS ADMIN ROUTES

### 16.1 Get All Payment Transactions (Admin)

**Endpoint:** `GET /api/payments/admin/all-transactions`

**Test Case 1: Get All Transactions**
```http
GET /api/payments/admin/all-transactions?page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "All payment transactions retrieved successfully",
  "data": {
    "transactions": [
      {
        "id": "trans-uuid",
        "user_id": "user-uuid",
        "username": "john_doe",
        "full_name": "John Doe",
        "email": "john@example.com",
        "amount": 10000.00,
        "currency": "NGN",
        "purpose": "gaming",
        "status": "completed",
        "reference": "PAY-20241127-001",
        "payment_gateway": "paystack",
        "created_at": "2024-11-27T14:00:00Z",
        "completed_at": "2024-11-27T14:01:30Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 25,
      "total_transactions": 489,
      "has_next": true,
      "has_prev": false,
      "limit": 20
    },
    "summary": {
      "total_amount": 4890000.00,
      "by_purpose": {
        "gaming": 2500000.00,
        "investment": 1890000.00,
        "upgrade": 500000.00
      },
      "by_status": {
        "completed": 456,
        "pending": 23,
        "failed": 10
      }
    }
  }
}
```

**Test Case 2: Filter by Purpose and Status**
```http
GET /api/payments/admin/all-transactions?purpose=gaming&status=completed&page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

**Test Case 3: Filter by User ID**
```http
GET /api/payments/admin/all-transactions?user_id=user-uuid&page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

**Test Case 4: Filter by Date Range**
```http
GET /api/payments/admin/all-transactions?date_from=2024-11-01T00:00:00Z&date_to=2024-11-30T23:59:59Z&page=1&limit=20
Authorization: Bearer ${ADMIN_TOKEN}
```

---

## 17. ADMIN ENDPOINTS SUMMARY

### Complete List of Admin Endpoints

#### Core Admin Routes (`/api/admin/`)
1. `GET /leaderboard/top-earners` - Public leaderboard
2. `GET /users` - Get all users
3. `GET /users/:userId` - Get user details
4. `GET /user/:userId/earnings` - Get user earnings
5. `PUT /users/:userId/status` - Update user status
6. `GET /withdrawals/pending` - Get pending withdrawals
7. `PUT /withdrawals/:transactionId/process` - Process withdrawal
8. `PUT /withdrawals/bulk-process` - Bulk process withdrawals
9. `GET /kashcoin/eligible-users` - Get coins eligible users
10. `GET /settings` - Get platform settings
11. `PUT /settings` - Update platform setting
12. `GET /dashboard/stats` - Get dashboard statistics

#### Gaming Admin Routes
13. `GET /api/coinflip/admin/statistics` - Coinflip game stats
14. `GET /api/mines/admin/statistics` - Mines game stats

#### Investment Admin Routes
15. `GET /api/investments/admin/all` - Get all investments
16. `GET /api/investments/admin/stats` - Investment statistics
17. `POST /api/investments/admin/process-payouts` - Process weekly payouts
18. `GET /api/investments/admin/withdrawals/pending` - Pending investment withdrawals
19. `PUT /api/investments/admin/withdrawals/:transactionId/process` - Process investment withdrawal
20. `PUT /api/investments/admin/withdrawals/bulk-process` - Bulk process investment withdrawals

#### Social Media Boost Admin Routes
21. `GET /api/social/admin/applications` - Get all boost applications
22. `PUT /api/social/admin/review/:id` - Review boost application
23. `GET /api/social/admin/statistics` - Boost statistics
24. `DELETE /api/social/admin/bulk-delete` - Bulk delete applications

#### Sponsored Posts Admin Routes
25. `POST /api/sponsored-posts/admin` - Create sponsored post
26. `GET /api/sponsored-posts/admin/all` - Get all sponsored posts
27. `PUT /api/sponsored-posts/admin/:id` - Update sponsored post
28. `DELETE /api/sponsored-posts/admin/:id` - Delete sponsored post

#### KashSkit Admin Routes
29. `POST /api/kashskit/admin/upload` - Upload video
30. `GET /api/kashskit/admin/videos` - Get all videos
31. `GET /api/kashskit/admin/videos/:videoId` - Get video details
32. `DELETE /api/kashskit/admin/videos/:videoId` - Delete video

#### Payments Admin Routes
33. `GET /api/payments/admin/all-transactions` - Get all payment transactions

**Total Admin Endpoints: 33**

---

## 18. INTEGRATION TEST CHECKLIST (UPDATED)

- [ ] **Core Admin Routes** (12 endpoints)
  - [ ] User management (5 endpoints)
  - [ ] Withdrawal management (3 endpoints)
  - [ ] Coins management (1 endpoint)
  - [ ] Settings management (2 endpoints)
  - [ ] Dashboard (1 endpoint)

- [ ] **Gaming Admin Routes** (2 endpoints)
  - [ ] Coinflip statistics
  - [ ] Mines statistics

- [ ] **Investment Admin Routes** (6 endpoints)
  - [ ] Get all investments
  - [ ] Investment statistics
  - [ ] Process payouts
  - [ ] Pending withdrawals
  - [ ] Process withdrawal
  - [ ] Bulk process withdrawals

- [ ] **Social Media Boost Admin Routes** (4 endpoints)
  - [ ] Get all applications
  - [ ] Review application
  - [ ] Boost statistics
  - [ ] Bulk delete

- [ ] **Sponsored Posts Admin Routes** (4 endpoints)
  - [ ] Create post
  - [ ] Get all posts
  - [ ] Update post
  - [ ] Delete post

- [ ] **KashSkit Admin Routes** (4 endpoints)
  - [ ] Upload video
  - [ ] Get all videos
  - [ ] Get video details
  - [ ] Delete video

- [ ] **Payments Admin Routes** (1 endpoint)
  - [ ] Get all transactions

---

## 19. POSTMAN COLLECTION STRUCTURE

```
KashPrime Admin API/
├── Core Admin/
│   ├── User Management/
│   │   ├── Get All Users
│   │   ├── Get User Details
│   │   ├── Get User Earnings
│   │   └── Update User Status
│   ├── Withdrawal Management/
│   │   ├── Get Pending Withdrawals
│   │   ├── Process Withdrawal
│   │   └── Bulk Process Withdrawals
│   ├── Coins Management/
│   │   └── Get Eligible Users
│   ├── Settings/
│   │   ├── Get Settings
│   │   └── Update Setting
│   └── Dashboard/
│       └── Get Dashboard Stats
├── Gaming Admin/
│   ├── Coinflip Statistics
│   └── Mines Statistics
├── Investment Admin/
│   ├── Get All Investments
│   ├── Investment Statistics
│   ├── Process Payouts
│   ├── Get Pending Withdrawals
│   ├── Process Withdrawal
│   └── Bulk Process Withdrawals
├── Social Media Boost Admin/
│   ├── Get All Applications
│   ├── Review Application
│   ├── Boost Statistics
│   └── Bulk Delete
├── Sponsored Posts Admin/
│   ├── Create Post
│   ├── Get All Posts
│   ├── Update Post
│   └── Delete Post
├── KashSkit Admin/
│   ├── Upload Video
│   ├── Get All Videos
│   ├── Get Video Details
│   └── Delete Video
└── Payments Admin/
    └── Get All Transactions
```

