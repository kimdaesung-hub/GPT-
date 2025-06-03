const express = require('express');
const axios = require('axios');
const cors = require('cors');
const xml2js = require('xml2js');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.LAW_API_KEY || 'nexpw';

app.use(cors());

// ✅ /law-all?id=011178&article=57의2
app.get('/law-all', async (req, res) => {
  const { id, article } = req.query;

  if (!id || !article) {
    return res.status(400).json({ error: 'id와 article 쿼리 파라미터가 필요합니다.' });
  }

  try {
    const url = `https://www.law.go.kr/DRF/lawService.do?OC=${API_KEY}&target=law&type=XML&ID=${id}`;
    const xml = await axios.get(url).then(r => r.data);
    const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });

    const 조문들 = parsed?.Law?.조문단위;
    if (!조문들) {
      return res.status(404).json({ error: '조문 목록을 찾을 수 없습니다.' });
    }

    const list = Array.isArray(조문들) ? 조문들 : [조문들];

    const target = list.find(조문 => {
      const 번호 = 조문.조문번호 || '';
      const 가지 = 조문.조문가지번호 || '';
      const 전체번호 = 가지 ? `${번호}의${가지}` : 번호;
      return 전체번호.replace(/^0+/, '') === article.replace(/^0+/, '');
    });

    if (!target) {
      return res.status(404).json({ error: `요청한 조문(${article})을 찾을 수 없습니다.` });
    }

    const result = {
      lawName: parsed?.Law?.법령명 || '',
      articleNumber: article,
      articleTitle: extractText(target.조문제목),
      articleContent: buildArticleContent(target)
    };

    res.json(result);
  } catch (err) {
    console.error('API 호출 실패:', err.message);
    res.status(500).json({ error: '외부 API 호출 중 오류가 발생했습니다.' });
  }
});

// ✅ 조문, 항, 호, 목을 포함한 본문 생성
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

// ✅ CDATA 또는 일반 텍스트 추출
function extractText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value['_']) return value['_'];
  if (value['#cdata-section']) return value['#cdata-section'];
  return '';
}

function normalizeArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

app.listen(PORT, () => {
  console.log(`✅ XML 기반 프록시 서버 실행 중: http://localhost:${PORT}`);
});
