const db = require('../config/db');
const adminCode = '2022084602' // TODO: admin code(본인 학번)를 추가하세요.

const getLoginPage = (req, res) => {
    res.render('pages/login', { title: 'Login' });
};

const getRegisterPage = (req, res) => {
    res.render('pages/register', { title: 'Register' });
};

const logoutAndGetHomePage = (req, res, next) => {
    req.session.destroy(err => {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
};

const postLogin = async (req, res, next) => {
    const { username, password } = req.body;
    try {
        /*
            TODO: username과 password를 이용해 로그인하는 코드를 작성하세요.
        */

        // 1. 입력 확인
        if (typeof username !== 'string' ||
            !username.trim() ||
            typeof password !== 'string' ||
            !password.trim()) {
            return res.status(400).send('아이디와 비밀번호를 입력하세요.');
        }

        // 2. 데이터베이스에서 사용자 조회
        const result = await db.query(`
            SELECT uid, login_id, admin FROM users WHERE login_id = $1 AND password = $2`,
            [username.trim(), password]);

        // 3. 로그인 실패 처리
        if (result.rows.length === 0) {
            return res.status(401).send('아이디 또는 비밀번호가 올바르지 않습니다.')
        }

        // 4. 조회된 사용자 정보 가져오기
        const user = result.rows[0];

        // 5. 세션에 로그인 정보 저장

        req.session.userId = user.uid;
        req.session.username = user.login_id;
        req.session.role = user.admin ? 'admin' : 'user';

        // 6. 홈 화면으로 이동
        res.redirect('/');

    } catch (err) {
        return next(err);
    }
};

const postRegister = async (req, res, next) => {
    const { username, password, role, admin_code } = req.body;

    try {
        /*
            TODO: username, password, role, admin_code를 이용해 새로운 계정을 추가하는 코드를 작성하세요.
        */
        // 1. 아이디와 비밀번호 확인
        if (!username || !username.trim() || !password) {
            return res.status(400).send('아이디와 비밀번호를 입력하세요.');
        }

        // 2. 아이디 길이 확인 (DB의 VARCHAR(50)에 맞춤)
        if (username.length > 50) {
            return res.status(400).send('아이디는 50자 이하여야 합니다.');
        }

        // 3. 역할 확인
        if (role !== 'user' && role !== 'admin') {
            return res.status(400).send('올바르지 않은 역할입니다.');
        }

        // 4. 관리자 코드 확인
        if (role === 'admin' && admin_code !== adminCode) {
            return res.status(403).send('관리자 코드가 올바르지 않습니다.');
        }

        // 5. 관리자 여부 결정
        const isAdmin = (role === 'admin');

        // 6. 아이디 중복 확인
        const existingUser = await db.query(
            `SELECT uid FROM users WHERE login_id = $1`,
            [username]
        );

        // 7. 회원 정보 추가
        await db.query(
            `INSERT INTO users (login_id, password, admin) VALUES ($1, $2, $3)`,
            [username, password, isAdmin]
        );

        // 8. 회원가입 성공
        res.redirect('/login');
    } catch (err) {
        // 동시 가입 요청 시 unique 제약조건 위반 가능.
        if (err.code === '23505') {
            return res.status(409).send('이미 존재하는 아이디입니다.');
        }

        return next(err);
    }
};

module.exports = {
    getLoginPage,
    getRegisterPage,
    logoutAndGetHomePage,
    postLogin,
    postRegister,
};

// experiment branch