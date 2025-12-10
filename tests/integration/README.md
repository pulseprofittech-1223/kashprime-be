# Admin Routes Integration Tests

This directory contains comprehensive integration tests for all admin routes in the KashPrime backend.

## 📁 Files

- **`admin-routes-test-data.md`** - Detailed documentation with sample requests, responses, and edge cases for all endpoints
- **`admin.routes.test.js`** - Executable Jest test suite for automated testing
- **`package.json`** - Test dependencies and scripts configuration

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd tests
npm install
```

Or install from project root:
```bash
npm install --save-dev jest supertest
```

### 2. Set Up Test Environment

Create a `.env.test` file in your project root:

```env
NODE_ENV=test
DATABASE_URL=your_test_database_url
JWT_SECRET=your_test_jwt_secret
PORT=5001
```

### 3. Run Tests

```bash
# Run all integration tests
npm test

# Run only admin routes tests
npm run test:admin

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## 📋 Test Coverage

The test suite covers:

### ✅ Public Routes
- Top earners leaderboard

### ✅ User Management
- Get all users (with pagination, filtering, search)
- Get user details (with full referral network)
- Get user earnings breakdown
- Update user status/tier/role

### ✅ Withdrawal Management
- Get pending withdrawals
- Approve withdrawals (all balance types)
- Decline withdrawals with refunds
- Bulk process withdrawals
- Error handling for invalid transactions

### ✅ Coins Management
- Get eligible users above threshold
- Search and filter eligible users

### ✅ Settings Management
- Get all platform settings
- Update individual settings

### ✅ Dashboard
- Get comprehensive dashboard statistics
- Verify balance calculations

### ✅ Authentication & Authorization
- Token validation
- Admin privilege verification

## 🔧 Configuration

### Test Data

Before running tests, you'll need:

1. **Admin Credentials**: Update the `beforeAll` hook in `admin.routes.test.js`:
   ```javascript
   const loginResponse = await request(app)
     .post('/api/auth/login')
     .send({
       email: 'your-admin@email.com',
       password: 'YourAdminPassword'
     });
   ```

2. **Test Database**: Ensure your test database has:
   - At least one admin user
   - Sample users with various tiers and roles
   - Sample transactions (optional, for withdrawal tests)
   - Platform settings configured

### Environment Variables

Required environment variables for tests:
- `NODE_ENV=test`
- `DATABASE_URL` - Test database connection
- `JWT_SECRET` - JWT signing secret
- `PORT` - Test server port (different from dev)

## 📖 Using the Test Data Documentation

The `admin-routes-test-data.md` file provides:

### 1. Sample Requests
Copy-paste ready HTTP requests for each endpoint with various scenarios

### 2. Expected Responses
Detailed JSON response structures for successful and error cases

### 3. cURL Examples
Command-line examples for manual testing:
```bash
curl -X GET "http://localhost:5000/api/admin/users?page=1&limit=20" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
```

### 4. Postman/Insomnia Import
Environment variables and request examples for API testing tools

### 5. Edge Cases
- Invalid UUIDs
- Missing required fields
- Validation errors
- Rate limiting scenarios
- Already processed transactions

## 🎯 Test Scenarios

### Balance Type Testing

The new wallet schema supports 4 balance types. Tests verify:

1. **Games Balance Withdrawals**
   - Approval updates `total_withdrawn_games`
   - Decline refunds to `games_balance`

2. **Referral Balance Withdrawals**
   - Approval updates `total_withdrawn_referral`
   - Decline refunds to `referral_balance`

3. **Investment Balance Withdrawals**
   - Approval updates `total_withdrawn_investment`
   - Decline refunds to `investment_balance`

4. **Coins Balance Withdrawals**
   - Approval updates `total_withdrawn_coins`
   - Decline refunds to `coins_balance`

### Bulk Operations

Tests verify:
- Processing multiple withdrawals of different balance types
- Partial success handling (some succeed, some fail)
- Transaction limits (max 50 per request)
- Proper refund calculations for bulk declines

## 🐛 Debugging Tests

### View Detailed Output

```bash
npm test -- --verbose
```

### Run Specific Test Suite

```bash
npm test -- --testNamePattern="User Management"
```

### Run Single Test

```bash
npm test -- --testNamePattern="should return paginated users list"
```

### Debug Mode

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome.

## 📊 Coverage Reports

Generate coverage report:

```bash
npm run test:coverage
```

View the HTML report:
```bash
open coverage/lcov-report/index.html
```

## 🔄 Continuous Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run migrations
        run: npm run migrate:test
      
      - name: Run integration tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          JWT_SECRET: test_secret
```

## 📝 Writing New Tests

### Template for New Test

```javascript
test('Description of what it should do', async () => {
  const response = await request(app)
    .get(`${BASE_URL}/your-endpoint`)
    .set(authHeader())
    .query({ param: 'value' });
  
  expect(response.status).toBe(200);
  expect(response.body.status).toBe('success');
  expect(response.body.data).toHaveProperty('expectedField');
});
```

### Best Practices

1. **Use Descriptive Names**: Test names should clearly describe what they're testing
2. **Test One Thing**: Each test should verify one specific behavior
3. **Clean Up**: Use `afterEach` or `afterAll` to clean up test data
4. **Avoid Dependencies**: Tests should not depend on each other
5. **Mock External Services**: Use mocks for email, SMS, payment gateways

## 🔐 Security Testing

The test suite includes security checks for:

- ✅ Authentication token validation
- ✅ Admin role verification
- ✅ Input validation
- ✅ SQL injection prevention (via parameterized queries)
- ✅ Rate limiting

## 📞 Support

If you encounter issues:

1. Check the test database is properly set up
2. Verify environment variables are correct
3. Ensure the server is not running on the test port
4. Review the detailed test output for specific errors

## 🎓 Learning Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Integration Testing Best Practices](https://martinfowler.com/bliki/IntegrationTest.html)

## 📄 License

This test suite is part of the KashPrime backend project.
