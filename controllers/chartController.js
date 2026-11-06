const db = require('../config/db');

const getChartsPage = async (req, res, next) => {
    let selectedCategoryId = req.query.categoryId ? Number(req.query.categoryId) : null;

    try {
        /*
            TODO: 차트 페이지를 렌더링하는 코드를 작성하세요.
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
        
        res.render('pages/charts', {
            title: 'Charts',
            popularBooks: popularBooksResult.rows,
            popularBooksByCategory: popularBooksByCategory,
            categories: categoryResult.rows,
            selectedCategoryId
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getChartsPage
};