// Loads .env so TEST_DATABASE_URL (and friends) are available to the suite.
import dotenv from 'dotenv';

dotenv.config();

process.env.NODE_ENV = 'test';
