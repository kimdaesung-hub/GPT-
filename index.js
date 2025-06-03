const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 국가법령정보 API KEY
const API_KEY = process.env.LAW_API_KEY; // 환경변수에서 가져오기

app.use(cors());

// /law?id=011178&article=1 요청 처리
app.get('/law', async (req, res) => {
  const { id, article } = req.query;

  if (!id || !article) {
    return res.status(400).json({ error: 'id와 article 파라미터가 필요합니다.' });
  }

  try {
    const apiUrl = `https://www.law.go.kr/DRF/lawService.do?OC=${API_KEY}&target=lawArticle&ID=${id}&article=${article}`;

    const { data } = await axios.get(apiUrl);
    const parsedXml = await xml2js.parseStringPromise(data, { explicitArray: false });

    const 조문단위 = parsedXml?.Law?.조문단위;
    if (!조문단위) {
      return res.status(404).json({ error: '조문을 찾을 수 없습니다.' });
    }

    const result = Array.isArray(조문단위) ? 조문단위[0] : 조문단위;

    const articleData = {
      lawName: parsedXml?.Law?.법령명 || '',
      articleNumber: result.조문번호 || '',
      articleTitle: getCdataOrText(result.조문제목),
      articleContent: buildArticleContent(result)
    };

    res.json(articleData);
  } catch (err) {
    console.error('오류 발생:', err.message);
    res.status(500).json({ error: '서버 오류 또는 외부 API 호출 실패' });
  }
});

// 콘텐츠 추출 함수
function buildArticleContent(조문) {
  let content = '';

  const 조문내용 = getCdataOrText(조문.조문내용);
  if (조문내용) content += `${조문내용}\n`;

  const 항목들 = normalizeArray(조문.항);
  for (const 항 of 항목들) {
    const 항번호 = getCdataOrText(항.항번호);
    const 항내용 = getCdataOrText(항.항내용);
    content += `\n${항번호} ${항내용}\n`;

    const 호들 = normalizeArray(항.호);
    for (const 호 of 호들) {
      const 호번호 = getCdataOrText(호.호번호);
      const 호내용 = getCdataOrText(호.호내용);
      content += `  ${호번호} ${호내용}\n`;

      const 목들 = normalizeArray(호.목);
      for (const 목 of 목들) {
        const 목번호 = getCdataOrText(목.목번호);
        const 목내용 = getCdataOrText(목.목내용);
        content += `    ${목번호} ${목내용}\n`;
      }
    }
  }

  return content.trim();
}

function getCdataOrText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value['#cdata-section']) return value['#cdata-section'];
  if (value['_']) return value['_'];
  return '';
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

app.listen(PORT, () => {
  console.log(`✅ 프록시 서버 실행 중: http://localhost:${PORT}`);
});
