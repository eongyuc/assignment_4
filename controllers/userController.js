const db = require('../config/db');

const getUsersPage = async (req, res, next) => {
    const { searchBy, query } = req.query;

    try {
        /*
            cleaer! TODO: 검색어에 맞춰 유저 목록을 출력하는 페이지를 렌더링하는 코드를 작성하세요.
        */

        const searchKeyword = typeof query === 'string' ? query.trim() : '';
        const searchType = searchBy === 'role' ? 'role' : 'username';

        let searchCondition = '';
        const params = [];

        if (searchKeyword) {
            if (searchType === 'username') {
                searchCondition = 'WHERE login_id ILIKE $1';
                params.push(`%${searchKeyword}%`);
            } else {
                searchCondition = `
                WHERE CASE
                    WHEN admin = TRUE THEN 'admin'
                    ELSE 'user'
                END = $1
                `;
                params.push(searchKeyword.toLowerCase());
            }
        }

        const userResult = await db.query(`
            SELECT
                uid AS id,
                login_id AS username,
                CASE
                    WHEN admin = TRUE THEN 'admin'
                    ELSE 'user'
                END AS role
            FROM users
            ${searchCondition}
            ORDER BY uid ASC;
            `, params);

        res.render('pages/users', {
            title: 'User Management',
            users: userResult.rows,
            searchBy: searchType,
            query: searchKeyword
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getUsersPage
};