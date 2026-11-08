const db = require('../config/db');

const getCategoriesPage = async (req, res, next) => {

    try {
        /*
            clear! TODO: 모든 카테고리를 출력하는 페이지를 렌더링하는 코드를 작성하세요.
        */

        const categoryResult = await db.query(`
            SELECT cid AS id, cname AS name
            FROM category
            ORDER BY cid ASC;
        `);
        
        res.render('pages/categories', {
            title: 'Category Management',
            categories: categoryResult.rows
        });
    } catch (err) {
        next(err);
    }
};

const postDeleteCategory = async (req, res, next) => {
    const categoryId = Number(req.params.id);

    // 관리자 권한 확인
    if (!req.session || req.session.role !== 'admin') {
        const err = new Error('Admin access required.');
        err.status = 403;
        return next(err);
    }

    // 카테고리 ID 유효성 검사
    if (!Number.isSafeInteger(categoryId) || categoryId < 1) {
        const err = new Error('Invalid category ID.');
        err.status = 400;
        return next(err)
    }

    let client;

    try {
        /*
            clear! TODO: 카테고리를 제거하는 코드를 작성하세요.
            만약 해당 카테고리에 포함된 책이 있다면 책에서 해당 카테고리만 지우고 나머지 카테고리는 유지하면 됩니다.
        */
        
        client = await db.pool.connect();
        await client.query('BEGIN');

        // 1. 카테고리 존재 여부 확인
        const categoryResult = await client.query(`
            SELECT cid
            FROM category
            WHERE cid = $1;
            `, [categoryId]);

        if (categoryResult.rows.length === 0) {
            const err = new Error('Category not found.');
            err.status = 404;
            throw err;
        }

        // 2. 책과 카테고리 사이의 연결 정보 삭제
        await client.query(`
            DELETE FROM book_category
            WHERE cid = $1;
            `, [categoryId]);
            
        // 3. 카테고리 자체 삭제
        await client.query(`
            DELETE FROM category
            WHERE cid = $1;
            `, [categoryId]);
        
        // 4. 변경사항 확정
        await client.query('COMMIT');

        res.redirect('/categories');

    } catch (err) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackErr) {
                console.error('Rollback failed:', rollbackErr);
            }
        }

        next(err);
    } finally {
        if (client) {
            client.release();
        }
    }
};

module.exports = {
    getCategoriesPage,
    postDeleteCategory
};