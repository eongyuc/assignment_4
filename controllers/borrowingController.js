const db = require('../config/db');

const getBorrowingsPage = async (req, res, next) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.redirect('/login');
    }

    try {
        /*
            cleaer! TODO: 유저의 대여 기록을 모두 출력하는 페이지를 렌더링하는 코드를 작성하세요.
        */
        // 1. 현재 사용자의 대출 기록 조회
        const borrowingResult = await db.query(`
            SELECT br.brid AS id,
                br.pid AS book_instance_id,
                b.title AS book_title,
                b.author AS book_author,
                TO_CHAR(br.borrow_at, 'YYYY-MM-DD') AS borrow_date,
                TO_CHAR(br.return_at, 'YYYY-MM-DD') AS return_date,
                TO_CHAR(br.borrow_at + 7, 'YYYY-MM-DD') AS due_date,

                CASE
                    WHEN br.return_at IS NOT NULL THEN 'Returned'
                    WHEN br.borrow_at <= CURRENT_DATE - 7 THEN 'Overdue'
                    ELSE 'Borrowed'
                END AS status
            
            FROM borrow br
            JOIN product p ON br.pid = p.pid
            JOIN book b ON p.bid = b.bid
            WHERE br.uid = $1
            ORDER BY br.borrow_at DESC, br.brid DESC;
            `, [userId]);

        // 2. 조회 결과를 EJS로 전달
        res.render('pages/borrowings', {
            title: 'My Borrowing History',
            borrowings: borrowingResult.rows // 대여 기록 리스트가 전달되어야 합니다.
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getBorrowingsPage
};