// 이 명령문으로 db.pool을 통해 Pool 객체에 접근 가능
// ../config/db 경로에 있는 db.js 파일을 찾음.
// 해당 파일의 module.exports 로 내보낸 값을 가져오고 그 값을 db에 넣음.
const db = require('../config/db');

const getBooksPage = async (req, res, next) => {

    // 웹페이지에서 검색하면 URL에 검색 조건이 전달됨.
    // /books?query=Harry&searchBy=title 같이 전달됨.
    // 이렇게 되면 searchQuery = 'Harry'; searchBy = 'title';
    const { query: searchQuery, searchBy, sortedBy, sortOrder } = req.query;

    const sortedByWithDefault = req.query.sortBy || 'title';
    const sortOrderWithDefault = req.query.sortOrder || 'asc';

    let searchCondition = '';
    const params = [];

    if (searchQuery && searchQuery.trim()) {
        const keyword = `%${searchQuery.trim()}%`;

        if (searchBy === 'title') {
            searchCondition = 'WHERE b.title ILIKE $1';
        } else if (searchBy === 'author') {
            searchCondition = 'WHERE b.author ILIKE $1';
        } else if (searchBy === 'category') { // 검색어에 해당하는 장르를 가진 책의 id 있는지 확인
            searchCondition = `
                WHERE EXISTS(
                    SELECT 1
                    FROM book_category bc2
                    JOIN category c2 ON bc2.cid = c2.cid
                    WHERE bc2.bid = b.bid AND c2.cname ILIKE $1    
                )
            `;
        }

        // 검색어를 $1 매개변수로 전달하기 위한 코드.
        if (searchCondition) {
            params.push(keyword);
        }
    }

    // 정렬기준 받기
    const sortColumns = {
        title: 'b.title',
        author: 'b.author',
        categories: 'categories'
    };

    const sortColumn = sortColumns[sortedByWithDefault] || 'b.title';
    const sortDirection = sortOrderWithDefault === 'desc' ? 'DESC' : 'ASC';

    try {
        /*
            cODO: 검색어, 정렬 기준에 맞춰 책 목록을 출력하는 페이지를 렌더링하는 코드를 작성하세요.
        */
        // 1. DB에서 도서 목록 조회
        const bookResult = await db.query(`
            SELECT
                b.bid AS id, b.title, b.author,
                COALESCE(
                    STRING_AGG(DISTINCT c.cname, ', ' ORDER BY c.cname), '') AS categories,
                
                COUNT(DISTINCT p.pid) AS total_quantity,

                COUNT(DISTINCT p.pid) FILTER (
                    WHERE NOT EXISTS(
                        SELECT 1
                        FROM borrow br
                        WHERE br.pid = p.pid AND br.return_at IS NULL
                    )
                ) AS available_quantity

            FROM book b

            LEFT JOIN product p ON b.bid = p.bid
            LEFT JOIN book_category bc ON b.bid = bc.bid
            LEFT JOIN category c ON bc.cid = c.cid

            ${searchCondition}

            GROUP BY b.bid, b.title, b.author
            ORDER BY ${sortColumn} ${sortDirection}, b.bid ASC;
            `, params);

        // 2. 조회 결과를 EJS에 전달.
        res.render('pages/books', {
            title: 'All Books',
            books: bookResult.rows, // 정렬된 검색 결과 리스트가 전달되어야 합니다. rows는 객체들의 배열
            sortBy: sortedByWithDefault,
            sortOrder: sortOrderWithDefault,
            query: searchQuery,
            searchBy: searchBy
        });
    } catch (err) {
        next(err);
    }
};


const getAddBookPage = async (req, res, next) => {
    const dummyCategories = [
        { id: 1, name: 'Fantasy' },
        { id: 2, name: 'Science Fiction' },
        { id: 3, name: 'Mystery' },
    ];
    const dummyAuthors = [
        { id: 1, name: 'J.R.R Tolkien' },
        { id: 2, name: 'Isaac Asimov' },
        { id: 3, name: 'Agatha Christie' },
    ];
    try {
        /*
            cODO: 책을 추가하는 페이지를 렌더링 하는 코드를 작성하세요.
            책 추가 시 작가와 카테고리를 선택해야하므로 현재 카테고리 목록과 작가 목록을 불러와야 합니다.
        */
        // 카테고리 목록 가져오기.
        const categoryResult = await db.query(`
            SELECT cid AS id, cname AS name
            FROM category
            ORDER BY cname;    
        `);

        // 작가 이름 목록 가져오기. 동명이인 존재 가능성 때문에 distinct.
        const authorResult = await db.query(`
            SELECT DISTINCT author AS name
            FROM book
            ORDER BY name;    
        `);

        // 기존 EJS에서 사용할 수 있는 형태로 변환
        const authors = authorResult.rows.map(author => ({
            id: author.name,
            name: author.name
        }));

        // 도서 추가 페이지 렌더링
        res.render('pages/add-book', {
            title: 'Add New Book',
            categories: categoryResult.rows, // 카테고리 리스트가 전달되어야 합니다.
            authors: authors, // 저자 리스트가 전달되어야 합니다.
        });
    } catch (err) {
        next(err);
    }
};


const postAddBook = async (req, res, next) => {
    const { title, authors, quantity, categories } = req.body;

    // 1. 입력값 확인
    const bookTitle = typeof title === 'string' ? title.trim() : '';
    const authorName = typeof authors === 'string' ? authors.trim() : '';
    const bookQuantity = Number(quantity);
    // bookTitle이 '' 인 경우에는 bookTitle이 false.

    // 오류 처리
    if (!bookTitle || !authorName ||
        !Number.isSafeInteger(bookQuantity) || bookQuantity < 1) {
        return res.status(400).send('올바른 도서 정보를 입력하세요.');
    }

    // category는 하나일 수도, 여러 개일 수도 있음.
    // category가 정의 안되면 빈 배열, 배열인 경우 그대로 사용, 정의는 됐으나 배열이 아니면 배열로 만들기.
    const categoryInputs = categories === undefined ? [] : Array.isArray(categories) ? categories : [categories];

    // ... 은 SET안에 들어있는 값들을 펼쳐서 하나의 배열로 만들어라.
    // SET함수의 결과는 배열이 아닌 {'a', 'b'} 같은 객체 이므로 map, filter함수 사용 x
    // filter로 값이 string인 것만 남김.
    // map으로 살아남은 문자열의 앞뒤 공백을 제거함.
    // 공백을 제외한 결과가 빈 문자열인 경우 제외.
    const categoryNames = [
        ...new Set(categoryInputs
            .filter(value => typeof value === 'string')
            .map(value => value.trim())
            .filter(value => value !== '')
        )
    ];

    let client;

    try {
        /*
            cODO: 책을 DB에 추가하는 작업을 수행하는 코드를 작성하세요.
            기존에 없는 카테고리와 저자 또한 추가해줘야 합니다.
        */

        // 2. DB 연결 및 트랜잭션 시작
        // connect를 호출해서 pool에 있는 연결 중 하나 가져옴.
        // connect()는 비동기 함수이므로 await 필요함.
        // 동일한 연결에서 계속 SQl을 실행할 수 있어야 하므로 connect 사용
        // BEGIN은 새로운 트랜잭션을 시작하는 SQL 명령어.
        // 트랜잭션이란 연결을 유지하며 실행하면서 오류 발생 시 롤백 가능하게 하는 것.
        client = await db.pool.connect();
        await client.query('BEGIN');

        // 3. book 테이블에 도서 정보 저장
        const existingBook = await client.query(`
            SELECT bid
            FROM book
            WHERE title = $1 AND author = $2;
            `, [bookTitle, authorName]);

        let bookId;

        if (existingBook.rows.length > 0) {
            // 이미 존재하는 도서라면 기존 bid 사용
            bookId = existingBook.rows[0].bid;
        } else { // 존재하지 않는 도서라면 새로 추가
            // title 에 $1, author에 $2 집어넣음.각각 bookTitle, authorName.
            // RETURNING 한다는 것은
            /*
            자동으로 생성해준 bid가 3이라고 가정했을 때,
            bookResult = {
                rows: [
                     {bid: 3}
                     ],
                     rowCount: 1,
                     // 그 밖의 정보
            };
            이라고 할 수 있음.
            따라서 bookResult.rows[0].bid = 3.
            */
            const bookResult = await client.query(`
                INSERT INTO book (title, author)
                VALUES ($1, $2)
                RETURNING bid`
                , [bookTitle, authorName]);

            bookId = bookResult.rows[0].bid;

        }
        // 4. 수량만큼 product 테이블에 소장본 추가
        // $1은 bookId
        // 즉, bid를 가진 행을 bookQuantity만큼 생성. 물론 pid는 자동생성.
        for (let i = 0; i < bookQuantity; i++) {
            await client.query(`
                INSERT INTO product (bid)
                VALUES ($1);
                `, [bookId]);
        }

        // 5. 카테고리 저장 및 도서와 연결
        // for(... of)문을 사용하여 배열의 원소를 하나씩 꺼내 반복함.
        for (const categoryValue of categoryNames) {
            let categoryId;
            // const와 달라 let은 선언한 변수에 다른 값을 넣을 수 있음.
            // let 또한 변수 선언임. 처음엔 undefined 저장.

            if (categoryValue.startsWith('id:')) {
                // 기존 카테고리를 선택한 경우
                // 서버에는 id:~ 형식으로 id가 전달됨. 
                // 따라서 id: 로 시작한 문자열은 이미 존재하는 문자열
                categoryId = Number(categoryValue.slice(3)); // 앞에 3문자인 id: 자르기

                if (!Number.isSafeInteger(categoryId) || categoryId < 1) {
                    throw new Error('올바르지 않은 카테고리 ID입니다.');
                }

                // existing에는 해당 cid가 존재할 경우 결과 행이 반환됨.
                const existing = await client.query(
                    'SELECT cid FROM category WHERE cid = $1',
                    [categoryId]
                );

                //결과 행이 반환이 안될 경우 존재하지 않는 카테고리이므로
                if (existing.rows.length === 0) {
                    throw new Error('존재하지 않는 카테고리입니다.');
                }
            } else {
                // 새로운 카테고리를 입력한 경우
                // on conflict를 사용하여 cname의 unique를 위반할 시
                // do update set에 따라 원래 있던 cname을
                // insert하려했던 행(excluded)의 cname으로 바꿈
                const result = await client.query(`
                    INSERT INTO category (cname)
                    VALUES ($1)
                    ON CONFLICT (cname)
                    DO UPDATE SET cname = EXCLUDED.cname
                    RETURNING cid;`
                    , [categoryValue]);

                categoryId = result.rows[0].cid;
            }

            // 도서와 카테고리 연결
            // 만약 원래 존재하던 bid, cid 조합일 경우 그냥 건너뛰자.
            await client.query(`
                INSERT INTO book_category (bid, cid)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING;
                `, [bookId, categoryId]);
        }

        // 6. 모든 작업이 성공하면 확정
        await client.query('COMMIT');

        res.redirect('/books');
    } catch (err) {
        // 오류 발생 시 변경사항 취소
        // 아예 connect()가 실패할 경우 client에 객체 저장 안됨.
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackErr) {
                console.error('Rollback failed:', rollbackErr); // 오류 정보 Node.js 서버의 콘솔에 출력하는 함수
            }
        }
        next(err);
    } finally {
        // DB 연결 반환
        if (client) client.release();
    }
};


const postDeleteBookInstance = async (req, res, next) => {
    const bookInstanceId = Number(req.params.id);

    try {
        /*
            TODO: 책 한 권을 제거하는 작업을 수행하는 코드를 작성하세요.
            동일한 책을 모두 제거하면 해당 책에 대한 정보도 지워지도록 구현해주세요.
        */
        res.redirect('/books');
    } catch (err) {
        next(err);
    }
};


const postBorrowBook = async (req, res, next) => {
    const bookInstanceId = Number(req.params.id);
    const userId = req.session.userId;

    if (!userId) {
        return res.redirect('/login');
    }

    try {
        /*
            TODO: 특정 책을 대여하는 작업을 수행하는 코드를 작성하세요.
            명세에 있는 조건들을 어기는 작업일 경우에는 다음과 같이 에러페이지로 유도하면 됩니다.

            ```
                const err = new Error('You have reached the maximum borrowing limit (3 books).');
                err.status = 400;
                return next(err);
            ```
        */
        res.redirect('/books');
    } catch (err) {
        next(err);
    }
};


const postReturnBook = async (req, res, next) => {
    const borrowingId = Number(req.params.id);
    const userId = req.session.userId;

    if (!userId) {
        return res.redirect('/login');
    }

    try {
        /*
            TODO: 자신이 책을 빌린 기록을 반납 처리하는 코드를 작성해주세요.
            다른 사람이 빌린 책은 반납할 수 없어야 합니다.
        */
        res.redirect('/borrowings');
    } catch (err) {
        next(err);
    }
};


const getBookInstances = async (req, res, next) => {
    const bookId = Number(req.params.id);
    const dummyInstances = [
        { id: 1, book_id: 1, borrowing_id: null, borrowed_by: null, borrow_date: null, status: 'available' },
        { id: 2, book_id: 1, borrowing_id: 1, borrowed_by: 'user1', borrow_date: '2025.10.01', status: 'borrowed' },
        { id: 3, book_id: 1, borrowing_id: null, borrowed_by: null, borrow_date: null, status: 'available' },
    ];

    try {
        /*
            TODO: 특정 동일한 책의 개별 리스트를 불러오는 코드를 작성해주세요.
        */
        res.json(dummyInstances);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getBooksPage,
    getAddBookPage,
    postAddBook,
    postDeleteBookInstance,
    postBorrowBook,
    postReturnBook,
    getBookInstances
};