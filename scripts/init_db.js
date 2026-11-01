const db = require('../config/db');

const initDB = async () => {
    try {
        // Drop existing tables in the correct order
        console.log('Deleting existing tables...');
        // TODO: 기존 테이블 제거하는 코드를 작성하세요.

        // Create tables
        console.log('Creating new tables...');
        // TODO: 설계한 스키마에 맞춰 새로운 테이블을 생성하는 코드를 작성하세요.
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                uid INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                login_id VARCHAR(50) NOT NULL UNIQUE,
                password TEXT NOT NULL,
                admin BOOLEAN NOT NULL DEFAULT FALSE
            );
        `); // test할 동안에는 테이블이 계속 없어지면 불편하니 유지.

        console.log('Database initialization completed successfully.');
    } catch (err) {
        console.error('Database initialization failed:', err);
    } finally {
        db.pool.end();
    }
};

initDB();
