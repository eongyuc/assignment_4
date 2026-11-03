const db = require('../config/db');

const initDB = async () => {
    try {
        // Drop existing tables in the correct order
        console.log('Deleting existing tables...');
        // clear! TODO: 기존 테이블 제거하는 코드를 작성하세요.
        
        /* 테스트 시 테이블 삭제방지를 위해 주석처리
        await db.query(`
            DROP TABLE IF EXISTS borrow;
            DROP TABLE IF EXISTS book_category;
            DROP TABLE IF EXISTS product;
            DROP TABLE IF EXISTS category;
            DROP TABLE IF EXISTS book;
            DROP TABLE IF EXISTS users;
        `);
        */

        // Create tables
        console.log('Creating new tables...');
        // clear! TODO: 설계한 스키마에 맞춰 새로운 테이블을 생성하는 코드를 작성하세요.

        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                uid INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                login_id VARCHAR(50) NOT NULL UNIQUE,
                password TEXT NOT NULL,
                admin BOOLEAN NOT NULL DEFAULT FALSE
            );
        `); // test할 동안에는 테이블이 계속 없어지면 불편하니 유지.

        // book 테이블
        await db.query(`
            CREATE TABLE IF NOT EXISTS book(
                bid INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                author VARCHAR(255) NOT NULL,
                UNIQUE (title, author)
                );
        `);

        // category 테이블
        await db.query(`
            CREATE TABLE IF NOT EXISTS category(
                cid INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                cname VARCHAR(100) NOT NULL UNIQUE
            );
        `);

        // product 테이블
        await db.query(`
            CREATE TABLE IF NOT EXISTS product(
                pid INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                bid INTEGER NOT NULL REFERENCES book(bid)
            );
        `); // bid는 book에 존재하는 것만 저장 가능.  

        await db.query(`
            CREATE TABLE IF NOT EXISTS book_category(
                bid INTEGER NOT NULL REFERENCES book(bid),
                cid INTEGER NOT NULL REFERENCES category(cid),
                PRIMARY KEY (bid, cid)
            );
        `); // bid는 book에, cid는 category에 반드시 존재하는 것만 저장 가능.  

        await db.query(`
            CREATE TABLE IF NOT EXISTS borrow (
                brid INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                uid INTEGER NOT NULL REFERENCES users(uid),
                pid INTEGER NOT NULL REFERENCES product(pid),
                borrow_at DATE NOT NULL DEFAULT CURRENT_DATE,
                return_at DATE
            );
        `);

        console.log('Database initialization completed successfully.');
    } catch (err) {
        console.error('Database initialization failed:', err);
    } finally {
        db.pool.end();
    }
};

initDB();
