import express from 'express';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

const BASE_URL = 'https://www.law.go.kr/DRF/lawService.do';
const OC = 'nexpw';
const TARGET = 'law';
const TYPE = 'json';

app.get('/', (req, res) => {
  res.send('✅ 국가법령정보 프록시 서버가 실행 중입니다.');
});

// 특정 조문 요청: /law?id=006320&article=1
app.get('/law', async (req, res) => {
  const { id, article } = req.query;

  if (!id || !article) {
    return res.status(400).json({ error: 'id와 article 쿼리 파라미터가 필요합니다.' });
  }

  try {
    const response = await axios.get(BASE_URL, {
      params: { OC, target: TARGET, type: TYPE, ID: id },
    });

    const lawData = response.data?.법령;
    if (!lawData) {
      return res.status(404).json({ error: '법령 데이터를 찾을 수 없습니다.' });
    }

    // 조문 데이터가 lawData.조문 안에 없고, 숫자 키로만 되어있는 경우 처리
    const allArticles = Object.values(lawData).filter(item => item?.조문번호);

    if (allArticles.length === 0) {
      return res.status(404).json({
        error: '이 법령에는 조문 데이터가 없습니다.',
        availableFields: Object.keys(lawData),
      });
    }

    const articleData = allArticles.find(a => a.조문번호 == article);

    if (!articleData) {
      return res.status(404).json({
        error: '조문 번호를 찾을 수 없습니다.',
        availableArticles: allArticles.map(a => a.조문번호),
      });
    }

    res.json({
      법령명: lawData.법령명_한글 || '알 수 없음',
      조문번호: articleData.조문번호,
      조문제목: articleData.조문제목 || '',
      조문내용: articleData.조문내용 || '',
    });

  } catch (err) {
    res.status(500).json({ error: '조회 실패', detail: err.message });
  }
});

// 개정문, 제개정이유 등 조회: /law-text?id=011178&field=개정문
app.get('/law-text', async (req, res) => {
  const { id, field } = req.query;

  if (!id || !field) {
    return res.status(400).json({ error: 'id와 field 쿼리 파라미터가 필요합니다.' });
  }

  try {
    const response = await axios.get(BASE_URL, {
      params: { OC, target: TARGET, type: TYPE, ID: id },
    });

    const lawData = response.data?.법령;
    if (!lawData || !lawData[field]) {
      return res.status(404).json({
        error: `요청하신 필드(${field})가 존재하지 않습니다.`,
        availableFields: Object.keys(lawData || {}),
      });
    }

    const value = lawData[field];
    const cleanValue = Array.isArray(value) ? value.flat().join('\n') : value;

    res.json({ [field]: cleanValue });

  } catch (err) {
    res.status(500).json({ error: '조회 실패', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy server listening on port ${PORT}`);
});
