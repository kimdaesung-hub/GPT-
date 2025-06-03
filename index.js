import express from 'express';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';

const app = express();
const PORT = process.env.PORT || 3000;

const BASE_URL = 'https://www.law.go.kr/DRF/lawService.do';
const OC = 'nexpw';  // 발급받은 사용자 인증키
const TARGET = 'law';
const TYPE = 'xml';  // XML로 요청

// 홈 경로
app.get('/', (req, res) => {
  res.send('📘 국가법령정보 XML 프록시 서버가 정상 동작 중입니다.');
});

// /law?id=법령ID&article=조문번호
app.get('/law', async (req, res) => {
  const { id, article } = req.query;

  if (!id || !article) {
    return res.status(400).json({ error: 'id와 article 쿼리 파라미터가 필요합니다.' });
  }

  try {
    const response = await axios.get(BASE_URL, {
      params: { OC, target: TARGET, type: TYPE, ID: id },
      responseType: 'text',
    });

    const parsed = await parseStringPromise(response.data, {
      explicitArray: false,
      trim: true,
    });

    const law = parsed?.법령;
    const rawArticles = law?.조문?.조문단위;

    if (!rawArticles) {
      return res.status(404).json({
        error: '이 법령에는 조문 데이터가 없습니다.',
        availableFields: Object.keys(law),
      });
    }

    const articleList = Array.isArray(rawArticles) ? rawArticles : [rawArticles];

    // 같은 번호의 조문 중 조문제목이 존재하는 것을 우선 선택
    const candidates = articleList.filter(a => a.조문번호 == article);
    const found = candidates.find(a => a.조문제목) || candidates[0];

    if (!found) {
      return res.status(404).json({
        error: '해당 조문번호를 찾을 수 없습니다.',
        availableArticles: articleList.map(a => a.조문번호 || null),
      });
    }

    res.json({
      법령명: law.기본정보?.법령명한글 || '알 수 없음',
      조문번호: found.조문번호,
      조문제목: found.조문제목 || '',
      조문내용: found.조문내용 || '',
    });

  } catch (err) {
    res.status(500).json({ error: '조회 실패', detail: err.message });
  }
});

// /law-text?id=법령ID&field=필드명 (ex: 개정문, 제개정이유)
app.get('/law-text', async (req, res) => {
  const { id, field } = req.query;

  if (!id || !field) {
    return res.status(400).json({ error: 'id와 field 쿼리 파라미터가 필요합니다.' });
  }

  try {
    const response = await axios.get(BASE_URL, {
      params: { OC, target: TARGET, type: TYPE, ID: id },
      responseType: 'text',
    });

    const parsed = await parseStringPromise(response.data, {
      explicitArray: false,
      trim: true,
    });

    const law = parsed?.법령;
    const value = law?.[field];

    if (!value) {
      return res.status(404).json({
        error: `요청하신 필드(${field})가 없습니다.`,
        availableFields: Object.keys(law || {}),
      });
    }

    const output = Array.isArray(value) ? value.join('\n') : value;
    res.json({ [field]: output });

  } catch (err) {
    res.status(500).json({ error: '조회 실패', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});
