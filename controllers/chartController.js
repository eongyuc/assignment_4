const db = require('../config/db');

const getChartsPage = async (req, res, next) => {
    let selectedCategoryId = req.query.categoryId ? Number(req.query.categoryId) : null;

    try {
        /*
            clear! TODO: 차트 페이지를 렌더링하는 코드를 작성하세요.
        */
        const popularBooksResult = await db.query(`
            SELECT
                b.bid, b.title, b.author,
                COALESCE(STRING_AGG(DISTINCT c.cname, ', ' ORDER BY c.cname), '')
                AS categories,
                COUNT(DISTINCT br.brid) AS borrow_count

            FROM borrow br
            JOIN product p ON br.pid = p.pid
            JOIN book b ON p.bid = b.bid
            LEFT JOIN book_category bc ON b.bid = bc.bid
            LEFT JOIN category c ON bc.cid = c.cid

            WHERE br.borrow_at >= CURRENT_DATE - INTERVAL '3 months'

            GROUP BY b.bid, b.title, b.author

            ORDER BY borrow_count DESC, b.title ASC;
        `);

        const categoryResult = await db.query(`
            SELECT
                cid AS id,
                cname AS name
            FROM category
            ORDER BY cname ASC;
        `);

        if (selectedCategoryId === null && categoryResult.rows.length > 0) {
            selectedCategoryId = categoryResult.rows[0].id;
        }

        let popularBooksByCategory = {};

        if (selectedCategoryId !== null) {
            const categoryBooksResult = await db.query(`
                SELECT b.bid, b.title, b.author, COALESCE(
                    STRING_AGG(DISTINCT c.cname, ', ' ORDER BY c.cname), ''
                ) AS categories,
                    COUNT(DISTINCT br.brid) AS borrow_count
                
                FROM borrow br
                JOIN product p ON br.pid = p.pid
                JOIN book b ON p.bid = b.bid
                LEFT JOIN book_category bc ON b.bid = bc.bid
                LEFT JOIN category c ON bc.cid = c.cid

                WHERE br.borrow_at >= CURRENT_DATE - INTERVAL '3 months'
                    AND EXISTS(
                        SELECT 1
                        FROM book_category bc2
                        WHERE bc2.bid = b.bid
                            AND bc2.cid = $1
                    )
                
                GROUP BY b.bid, b.title, b.author

                ORDER BY borrow_count DESC, b.title ASC;
                `, [selectedCategoryId]);

            const selectedCategory = categoryResult.rows.find(
                category => category.id === selectedCategoryId
            );

            if (selectedCategory) {
                popularBooksByCategory[selectedCategory.name] = categoryBooksResult.rows;
            }
        }

        // 월별 대출 횟수 조회
        const monthlyBorrowResult = await db.query(`
            SELECT
                TO_CHAR(m.month, 'YYYY-MM') AS month,
                COUNT(br.brid) AS borrow_count
            FROM generate_series(
                DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
                DATE_TRUNC('month', CURRENT_DATE),
                INTERVAL '1 month'
            ) AS m(month)
            LEFT JOIN borrow br
                ON br.borrow_at >= m.month
                AND br.borrow_at < m.month + INTERVAL '1 month'

            GROUP BY m.month
            ORDER BY m.month ASC;
            `);

        const monthlyBorrows = monthlyBorrowResult.rows;

        const maxBorrowCount = Math.max(
            1,
            ...monthlyBorrows.map(item => Number(item.borrow_count))
        );


        const inventoryResult = await db.query(`
        SELECT
            (SELECT COUNT(*) FROM product) AS total_copies,

            (
                SELECT COUNT(DISTINCT pid)
                FROM borrow
                WHERE return_at IS NULL
            ) AS borrowed_copies;
        `);

        const totalCopies = Number(inventoryResult.rows[0].total_copies);
        const borrowedCopies = Number(inventoryResult.rows[0].borrowed_copies);

        const availableCopies = totalCopies - borrowedCopies;

        const borrowingRate = totalCopies === 0
            ? 0
            : (borrowedCopies / totalCopies * 100).toFixed(1);


        res.render('pages/charts', {
            title: 'Charts',
            popularBooks: popularBooksResult.rows,
            popularBooksByCategory: popularBooksByCategory,
            categories: categoryResult.rows,
            selectedCategoryId,
            monthlyBorrows: monthlyBorrowResult.rows,
            maxBorrowCount: maxBorrowCount,

            inventory: {
                totalCopies,
                borrowedCopies,
                availableCopies,
                borrowingRate
            }
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getChartsPage
};