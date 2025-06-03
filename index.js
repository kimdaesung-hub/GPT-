import express from 'express';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';

const app = express();
const PORT = process.env.PORT || 3000;

const BASE_URL = 'https://www.law.go.kr/DRF/lawService.do';
const OC = 'nexpw';
const TARGET = 'law';
const TYPE = 'xml'; // JSON → XML로 변경

// 홈 경로 테스트
app.get('/', (req, res) => {
  res.send('📘 XML 기반 국가법령정보 프록시 서버입니다.');
});

// 조문 번호로 특정 조항 추출
app.get('/law', async (req, res) => {
  const { id, article } = req.query;

  if (!id || !article) {
    return res.status(400).json({ error: 'id와 article 쿼리 파라미터가 필요합니다.' });
  }

  try {
    // XML 데이터 요청
    const response = await axios.get(BASE_URL, {
      params: { OC, target: TARGET, type: TYPE, ID: id },
      responseType: 'text',
    });

    // XML → JSON 변환
    const jsonResult = await parseStringPromise(response.data, { explicitArray: false });
    const law = jsonResult.법령;

    if (!law) {
      return res.status(404).json({ error: '법령 데이터를 찾을 수 없습니다.' });
    }

    const articles = law.조문;
    if (!articles) {
      return res.status(404).json({
        error: '이 법령에는 조문이 없습니다.',
        availableFields: Object.keys(law),
      });
    }

    // 단일 조문인지, 배열인지 확인
    const articleList = Array.isArray(articles) ? articles : [articles];

    const found = articleList.find(a => a.조문번호 == article);

    if (!found) {
      return res.status(404).json({
        error: '해당 조문번호를 찾을 수 없습니다.',
        availableArticles: articleList.map(a => a.조문번호),
      });
    }

    res.json({
      법령명: law.기본정보?.법령명한글 || '알 수 없음',
      조문번호: found.조문번호,
      조문제목: found.조문제목,
      조문내용: found.조문내용,
    });

  } catch (err) {
    res.status(500).json({ error: '조회 실패', detail: err.message });
  }
});

// 기타 필드(개정문, 제개정이유 등) 조회
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

    const law = await parseStringPromise(response.data, { explicitArray: false });

    const value = law?.법령?.[field];
    if (!value) {
      return res.status(404).json({
        error: `요청하신 필드(${field})가 없습니다.`,
        availableFields: Object.keys(law?.법령 || {}),
      });
    }

    const flat = Array.isArray(value) ? value.join('\n') : value;
    res.json({ [field]: flat });

  } catch (err) {
    res.status(500).json({ error: '조회 실패', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ XML Proxy server running on port ${PORT}`);
});
