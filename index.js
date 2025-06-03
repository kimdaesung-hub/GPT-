const express = require('express');
const axios = require('axios');
const cors = require('cors');

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
    const url = `https://www.law.go.kr/DRF/lawService.do?OC=${API_KEY}&target=law&type=json&ID=${id}`;
    const response = await axios.get(url);
    const data = response.data;

    const 조문들 = data?.Law?.조문단위;
    if (!Array.isArray(조문들)) {
      return res.status(404).json({ error: '조문 목록을 찾을 수 없습니다.' });
    }

    const target = 조문들.find(조문 => {
      const 번호 = 조문.조문번호 || '';
      const 가지 = 조문.조문가지번호 || '';
      const 전체번호 = 가지 ? `${번호}의${가지}` : 번호;
      return 전체번호 === article;
    });

    if (!target) {
      return res.status(404).json({ error: `요청한 조문(${article})을 찾을 수 없습니다.` });
    }

    const result = {
      lawName: data?.Law?.법령명 || '',
      articleNumber: article,
      articleTitle: target.조문제목 || '',
      articleContent: buildArticleContent(target)
    };

    res.json(result);
  } catch (err) {
    console.error('API 호출 실패:', err.message);
    res.status(500).json({ error: '외부 API 호출 중 오류가 발생했습니다.' });
  }
});

// 🧠 조문, 항, 호, 목까지 모두 합쳐서 본문 구성
function buildArticleContent(조문) {
  let content = '';

  if (조문.조문내용) content += `${조문.조문내용}\n`;

  const 항들 = normalizeArray(조문.항);
  for (const 항 of 항들) {
    const 항번호 = 항.항번호 || '';
    const 항내용 = 항.항내용 || '';
    content += `\n${항번호} ${항내용}\n`;

    const 호들 = normalizeArray(항.호);
    for (const 호 of 호들) {
      const 호번호 = 호.호번호 || '';
      const 호내용 = 호.호내용 || '';
      content += `  ${호번호} ${호내용}\n`;

      const 목들 = normalizeArray(호.목);
      for (const 목 of 목들) {
        const 목번호 = 목.목번호 || '';
        const 목내용 = 목.목내용 || '';
        content += `    ${목번호} ${목내용}\n`;
      }
    }
  }

  return content.trim();
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

app.listen(PORT, () => {
  console.log(`✅ 프록시 서버 실행 중: http://localhost:${PORT}`);
});
