/**
 * Admin Routes Integration Tests
 * 
 * Prerequisites:
 * - npm install --save-dev jest supertest
 * - Ensure test database is set up
 * - Create test admin user and get JWT token
 */

const request = require('supertest');
const app = require('../../src/app'); // Adjust path as needed

// Test configuration
const BASE_URL = '/api/admin';
let adminToken = ''; // Will be set in beforeAll
let testUserId = '';
let testTransactionId = '';

// Helper function to set auth header
const authHeader = () => ({ Authorization: `Bearer ${adminToken}` });

describe('Admin Routes Integration Tests', () => {
  
  // Setup: Login as admin and get token
  beforeAll(async () => {
    // TODO: Replace with actual admin login
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@kashprime.com',
        password: 'AdminPassword123!'
      });
    
    adminToken = loginResponse.body.data.token;
    
    // Get a test user ID
    const usersResponse = await request(app)
      .get(`${BASE_URL}/users`)
      .set(authHeader())
      .query({ limit: 1 });
    
    if (usersResponse.body.data.users.length > 0) {
      testUserId = usersResponse.body.data.users[0].id;
    }
  });

  // ==================== PUBLIC ROUTES ====================
  
  describe('Public Routes', () => {
    
    test('GET /leaderboard/top-earners - should return top earners without auth', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/leaderboard/top-earners`);
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('top_earners');
      expect(Array.isArray(response.body.data.top_earners)).toBe(true);
      expect(response.body.data.top_earners.length).toBeLessThanOrEqual(10);
      
      if (response.body.data.top_earners.length > 0) {
        const topEarner = response.body.data.top_earners[0];
        expect(topEarner).toHaveProperty('rank');
        expect(topEarner).toHaveProperty('username');
        expect(topEarner).toHaveProperty('current_balance');
        expect(topEarner).toHaveProperty('other_balances');
      }
    });
  });

  // ==================== USER MANAGEMENT ROUTES ====================
  
  describe('User Management', () => {
    
    test('GET /users - should return paginated users list', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/users`)
        .set(authHeader())
        .query({ page: 1, limit: 20 });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.users)).toBe(true);
      
      const pagination = response.body.data.pagination;
      expect(pagination).toHaveProperty('current_page');
      expect(pagination).toHaveProperty('total_pages');
      expect(pagination).toHaveProperty('total_users');
      expect(pagination).toHaveProperty('has_next');
      expect(pagination).toHaveProperty('has_prev');
      expect(pagination.limit).toBe(20);
    });

    test('GET /users - should filter by role', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/users`)
        .set(authHeader())
        .query({ role: 'user', limit: 10 });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      
      if (response.body.data.users.length > 0) {
        response.body.data.users.forEach(user => {
          expect(user.role).toBe('user');
        });
      }
    });

    test('GET /users - should filter by user_tier', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/users`)
        .set(authHeader())
        .query({ user_tier: 'Pro', limit: 10 });
      
      expect(response.status).toBe(200);
      
      if (response.body.data.users.length > 0) {
        response.body.data.users.forEach(user => {
          expect(user.user_tier).toBe('Pro');
        });
      }
    });

    test('GET /users - should search by username/email', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/users`)
        .set(authHeader())
        .query({ search: 'test', limit: 10 });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });

    test('GET /users/:userId - should return detailed user info', async () => {
      if (!testUserId) {
        console.log('Skipping: No test user ID available');
        return;
      }

      const response = await request(app)
        .get(`${BASE_URL}/users/${testUserId}`)
        .set(authHeader());
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('referral_network');
      expect(response.body.data).toHaveProperty('referral_stats');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('transactions');
      
      const user = response.body.data.user;
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('decrypted_password');
      expect(user).toHaveProperty('wallets');
      
      if (user.wallets && user.wallets.length > 0) {
        const wallet = user.wallets[0];
        expect(wallet).toHaveProperty('games_balance');
        expect(wallet).toHaveProperty('referral_balance');
        expect(wallet).toHaveProperty('investment_balance');
        expect(wallet).toHaveProperty('coins_balance');
        expect(wallet).toHaveProperty('total_withdrawn_games');
        expect(wallet).toHaveProperty('total_withdrawn_referral');
        expect(wallet).toHaveProperty('total_withdrawn_investment');
        expect(wallet).toHaveProperty('total_withdrawn_coins');
      }
    });

    test('GET /users/:userId - should return 404 for non-existent user', async () => {
      const fakeUserId = '999e8400-e29b-41d4-a716-446655440000';
      
      const response = await request(app)
        .get(`${BASE_URL}/users/${fakeUserId}`)
        .set(authHeader());
      
      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
    });

    test('GET /user/:userId/earnings - should return earnings breakdown', async () => {
      if (!testUserId) {
        console.log('Skipping: No test user ID available');
        return;
      }

      const response = await request(app)
        .get(`${BASE_URL}/user/${testUserId}/earnings`)
        .set(authHeader())
        .query({ days: 30 });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('current_wallet');
      expect(response.body.data).toHaveProperty('earnings_summary');
      expect(response.body.data).toHaveProperty('deductions_summary');
      expect(response.body.data).toHaveProperty('net_summary');
      expect(response.body.data).toHaveProperty('referral_statistics');
      expect(response.body.data).toHaveProperty('recent_transactions');
      
      const wallet = response.body.data.current_wallet;
      expect(wallet).toHaveProperty('coins_balance');
      expect(wallet).toHaveProperty('games_balance');
      expect(wallet).toHaveProperty('referral_balance');
      expect(wallet).toHaveProperty('investment_balance');
    });

    test('PUT /users/:userId/status - should update user status', async () => {
      if (!testUserId) {
        console.log('Skipping: No test user ID available');
        return;
      }

      const response = await request(app)
        .put(`${BASE_URL}/users/${testUserId}/status`)
        .set(authHeader())
        .send({ account_status: 'active' });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.account_status).toBe('active');
    });

    test('PUT /users/:userId/status - should reject invalid status', async () => {
      if (!testUserId) {
        console.log('Skipping: No test user ID available');
        return;
      }

      const response = await request(app)
        .put(`${BASE_URL}/users/${testUserId}/status`)
        .set(authHeader())
        .send({ account_status: 'invalid_status' });
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  // ==================== WITHDRAWAL MANAGEMENT ROUTES ====================
  
  describe('Withdrawal Management', () => {
    
    test('GET /withdrawals/pending - should return pending withdrawals', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/withdrawals/pending`)
        .set(authHeader())
        .query({ page: 1, limit: 20 });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('withdrawals');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.withdrawals)).toBe(true);
      
      if (response.body.data.withdrawals.length > 0) {
        const withdrawal = response.body.data.withdrawals[0];
        expect(withdrawal).toHaveProperty('id');
        expect(withdrawal).toHaveProperty('user_id');
        expect(withdrawal).toHaveProperty('amount');
        expect(withdrawal).toHaveProperty('balance_type');
        expect(withdrawal).toHaveProperty('users');
        
        // Save for later tests
        testTransactionId = withdrawal.id;
      }
    });

    test('GET /withdrawals/pending - should filter by search', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/withdrawals/pending`)
        .set(authHeader())
        .query({ search: 'test', limit: 10 });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });

    test('PUT /withdrawals/:transactionId/process - should approve withdrawal', async () => {
      if (!testTransactionId) {
        console.log('Skipping: No pending withdrawal available');
        return;
      }

      const response = await request(app)
        .put(`${BASE_URL}/withdrawals/${testTransactionId}/process`)
        .set(authHeader())
        .send({ action: 'approve' });
      
      // Could be 200 (success) or 404 (already processed)
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body.status).toBe('success');
        expect(response.body.data).toHaveProperty('transactionId');
        expect(response.body.data).toHaveProperty('action');
        expect(response.body.data.action).toBe('approve');
        expect(response.body.data).toHaveProperty('balance_type');
        expect(response.body.data).toHaveProperty('new_total_withdrawn');
      }
    });

    test('PUT /withdrawals/:transactionId/process - should decline withdrawal with refund', async () => {
      // This test requires a fresh pending withdrawal
      // In real scenario, create a test withdrawal first
      const fakeTransactionId = '660e8400-e29b-41d4-a716-446655440001';
      
      const response = await request(app)
        .put(`${BASE_URL}/withdrawals/${fakeTransactionId}/process`)
        .set(authHeader())
        .send({ 
          action: 'decline',
          decline_reason: 'Test decline for integration testing'
        });
      
      // Expect 404 since it's a fake ID
      expect(response.status).toBe(404);
    });

    test('PUT /withdrawals/:transactionId/process - should reject invalid action', async () => {
      const fakeTransactionId = '660e8400-e29b-41d4-a716-446655440001';
      
      const response = await request(app)
        .put(`${BASE_URL}/withdrawals/${fakeTransactionId}/process`)
        .set(authHeader())
        .send({ action: 'invalid_action' });
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });

    test('PUT /withdrawals/bulk-process - should handle bulk approval', async () => {
      const response = await request(app)
        .put(`${BASE_URL}/withdrawals/bulk-process`)
        .set(authHeader())
        .send({
          transaction_ids: [
            '660e8400-e29b-41d4-a716-446655440001',
            '770e8400-e29b-41d4-a716-446655440002'
          ],
          action: 'approve'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('processed_count');
      expect(response.body.data).toHaveProperty('failed_count');
      expect(response.body.data).toHaveProperty('total_requested');
      expect(response.body.data.total_requested).toBe(2);
    });

    test('PUT /withdrawals/bulk-process - should reject empty array', async () => {
      const response = await request(app)
        .put(`${BASE_URL}/withdrawals/bulk-process`)
        .set(authHeader())
        .send({
          transaction_ids: [],
          action: 'approve'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });

    test('PUT /withdrawals/bulk-process - should reject too many transactions', async () => {
      const tooManyIds = Array(51).fill('660e8400-e29b-41d4-a716-446655440001');
      
      const response = await request(app)
        .put(`${BASE_URL}/withdrawals/bulk-process`)
        .set(authHeader())
        .send({
          transaction_ids: tooManyIds,
          action: 'approve'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  // ==================== KASHCOIN/COINS MANAGEMENT ROUTES ====================
  
  describe('Coins Management', () => {
    
    test('GET /kashcoin/eligible-users - should return users above threshold', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/kashcoin/eligible-users`)
        .set(authHeader())
        .query({ page: 1, limit: 20 });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('threshold');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.users)).toBe(true);
      
      if (response.body.data.users.length > 0) {
        const user = response.body.data.users[0];
        expect(user).toHaveProperty('coins_balance');
        expect(user).toHaveProperty('users');
        expect(user.coins_balance).toBeGreaterThanOrEqual(response.body.data.threshold);
      }
    });

    test('GET /kashcoin/eligible-users - should search eligible users', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/kashcoin/eligible-users`)
        .set(authHeader())
        .query({ search: 'test', limit: 10 });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });
  });

  // ==================== SETTINGS MANAGEMENT ROUTES ====================
  
  describe('Settings Management', () => {
    
    test('GET /settings - should return all platform settings', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/settings`)
        .set(authHeader());
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('settings');
      expect(Array.isArray(response.body.data.settings)).toBe(true);
      
      if (response.body.data.settings.length > 0) {
        const setting = response.body.data.settings[0];
        expect(setting).toHaveProperty('setting_key');
        expect(setting).toHaveProperty('setting_value');
      }
    });

    test('PUT /settings - should update a setting', async () => {
      const response = await request(app)
        .put(`${BASE_URL}/settings`)
        .set(authHeader())
        .send({
          setting_key: 'coins_withdrawal_threshold',
          setting_value: '40000'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('setting');
      expect(response.body.data.setting.setting_key).toBe('coins_withdrawal_threshold');
    });

    test('PUT /settings - should reject empty setting key', async () => {
      const response = await request(app)
        .put(`${BASE_URL}/settings`)
        .set(authHeader())
        .send({
          setting_key: '',
          setting_value: '5000'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
    });
  });

  // ==================== DASHBOARD ROUTES ====================
  
  describe('Dashboard', () => {
    
    test('GET /dashboard/stats - should return comprehensive stats', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/dashboard/stats`)
        .set(authHeader());
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      
      const stats = response.body.data;
      expect(stats).toHaveProperty('users');
      expect(stats).toHaveProperty('revenue');
      expect(stats).toHaveProperty('payables');
      expect(stats).toHaveProperty('recent_users');
      
      // Verify users stats
      expect(stats.users).toHaveProperty('total');
      expect(stats.users).toHaveProperty('pro');
      expect(stats.users).toHaveProperty('free');
      
      // Verify revenue stats
      expect(stats.revenue).toHaveProperty('total');
      expect(stats.revenue).toHaveProperty('breakdown');
      expect(stats.revenue.breakdown).toHaveProperty('pro_subscriptions');
      expect(stats.revenue.breakdown).toHaveProperty('games_revenue');
      
      // Verify payables stats
      expect(stats.payables).toHaveProperty('total');
      expect(stats.payables).toHaveProperty('breakdown');
      expect(stats.payables.breakdown).toHaveProperty('investments_pending');
      expect(stats.payables.breakdown).toHaveProperty('referrals_due');
    });
  });

  // ==================== AUTHENTICATION & AUTHORIZATION ====================
  
  describe('Authentication & Authorization', () => {
    
    test('Should reject requests without token', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/users`);
      
      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });

    test('Should reject requests with invalid token', async () => {
      const response = await request(app)
        .get(`${BASE_URL}/users`)
        .set({ Authorization: 'Bearer invalid_token_here' });
      
      expect(response.status).toBe(401);
      expect(response.body.status).toBe('error');
    });
  });
});

// Export for use in other test files
module.exports = {
  BASE_URL,
  authHeader
};
