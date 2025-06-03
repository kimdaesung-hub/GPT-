const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.LAW_API_KEY || 'nexpw';

app.use(cors());

// ✅ /law?id=011178&article=57의2
app.get('/law', async (req, res) => {
  const { id, article } = req.query;

  if (!id || !article) {
    return res.status(400).json({ error: 'id와 article 쿼리 파라미터가 필요합니다.' });
  }

  try {
    const url = `https://www.law.go.kr/DRF/lawService.do?OC=${API_KEY}&target=lawArticle&type=XML&ID=${id}&article=${encodeURIComponent(article)}`;
    const xml = await axios.get(url).then(r => r.data);
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });

    const lawName = parsed?.Law?.법령명 || '';
    const 조문 = parsed?.Law?.조문단위;

    if (!조문) {
      return res.status(404).json({ error: '요청한 조문을 찾을 수 없습니다.' });
    }

    const result = {
      lawName,
      articleNumber: article,
      articleTitle: extractText(조문.조문제목),
      articleContent: buildArticleContent(조문)
    };

    return res.json(result);
  } catch (err) {
    console.error('API 호출 실패:', err.message);
    return res.status(500).json({ error: '외부 API 호출 중 오류가 발생했습니다.' });
  }
});

// ✅ 조문 본문 구성
function buildArticleContent(조문) {
  let content = '';

  if (조문.조문내용) {
    content += extractText(조문.조문내용) + '\n';
  }

  const 항들 = normalizeArray(조문.항);
  for (const 항 of 항들) {
    const 항번호 = extractText(항.항번호);
    const 항내용 = extractText(항.항내용);
    content += `\n${항번호} ${항내용}\n`;

    const 호들 = normalizeArray(항.호);
    for (const 호 of 호들) {
      const 호번호 = extractText(호.호번호);
      const 호내용 = extractText(호.호내용);
      content += `  ${호번호} ${호내용}\n`;

      const 목들 = normalizeArray(호.목);
      for (const 목 of 목들) {
        const 목번호 = extractText(목.목번호);
        const 목내용 = extractText(목.목내용);
        content += `    ${목번호} ${목내용}\n`;
      }
    }
  }

  return content.trim();
}

// ✅ 유틸 함수들
function extractText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value['_']) return value['_'];
  if (value['#cdata-section']) return value['#cdata-section'];
  return '';
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

app.listen(PORT, () => {
  console.log(`✅ 단일 조문 전용 프록시 서버 실행 중: http://localhost:${PORT}`);
});
