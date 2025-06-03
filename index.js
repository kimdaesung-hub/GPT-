import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { parseStringPromise } from 'xml2js';

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.LAW_API_KEY || 'nexpw';

app.use(cors());

app.get('/law', async (req, res) => {
  const { id, article } = req.query;

  if (!id || !article) {
    return res.status(400).json({ error: 'id와 article 쿼리 파라미터가 필요합니다.' });
  }

  try {
    const url = `https://www.law.go.kr/DRF/lawService.do?OC=${API_KEY}&target=law&type=xml&ID=${id}`;
    const xml = await axios.get(url).then(r => r.data);
    const parsed = await parseStringPromise(xml, { explicitArray: false });

    const lawName = parsed?.Law?.법령명 || '';
    const 조문들 = normalizeArray(parsed?.Law?.조문단위);

    // ✅ 조문번호 매핑 처리
    const formattedArticle = formatArticleNumber(article);

    const target = 조문들.find(j => {
      const 번호 = j?.조문번호 || '';
      const 가지 = j?.조문가지번호 || '';
      const full = 가지 ? `${번호}의${가지}` : 번호;
      return full === formattedArticle;
    });

    if (!target) {
      return res.status(404).json({ error: `요청한 조문(${article})을 찾을 수 없습니다.` });
    }

    const result = {
      lawName,
      articleNumber: article,
      articleTitle: extractText(target.조문제목),
      articleContent: buildArticleContent(target)
    };

    res.json(result);
  } catch (err) {
    console.error('API 호출 오류:', err.message);
    res.status(500).json({ error: '외부 API 호출 중 오류가 발생했습니다.' });
  }
});

// ✅ 조문번호 매핑 테이블
function formatArticleNumber(input) {
  const table = {
    '1': '0001000',
    '2': '0002000',
    '3': '0003000',
    '10': '0010000',
    '57의2': '0057020'
    // 필요한 조문번호는 여기에 계속 추가
  };

  if (table[input]) return table[input];

  // 이미 7자리면 그대로 사용
  if (/^\d{7}$/.test(input)) return input;

  return input; // fallback
}

// ✅ 조문 내용 구성
function buildArticleContent(조문) {
  let content = '';
  if (조문.조문내용) content += extractText(조문.조문내용) + '\n';

  const 항들 = normalizeArray(조문.항);
  for (const 항 of 항들) {
    content += `\n${extractText(항.항번호)} ${extractText(항.항내용)}\n`;

    const 호들 = normalizeArray(항.호);
    for (const 호 of 호들) {
      content += `  ${extractText(호.호번호)} ${extractText(호.호내용)}\n`;

      const 목들 = normalizeArray(호.목);
      for (const 목 of 목들) {
        content += `    ${extractText(목.목번호)} ${extractText(목.목내용)}\n`;
      }
    }
  }

  return content.trim();
}

// ✅ 안전한 텍스트 추출
function extractText(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val._ || val['#cdata-section'] || '';
}

// ✅ 배열 아닌 경우도 배열처럼 처리
function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// ✅ 서버 실행
app.listen(PORT, () => {
  console.log(`✅ 프록시 서버 실행 중: http://localhost:${PORT}`);
});
