import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.LAW_API_KEY || 'nexpw';
const LAW_ID = '011178'; // 지방세특례제한법

app.use(cors());
app.use(express.json());

app.get('/law/query', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'q 쿼리 파라미터는 필수입니다.' });
  }

  // 예: "지방세특례제한법 제1조 내용알려줘"
  const articleMatch = q.match(/제\s*([0-9]+)(조(?:의[0-9]+)?)?/);
  if (!articleMatch) {
    return res.status(400).json({ error: '요청에서 조문 번호를 찾을 수 없습니다.' });
  }

  const base = articleMatch[1]; // e.g., 1
  const extra = articleMatch[2]?.replace(/[^의0-9]/g, '') || ''; // e.g., '의2'
  const articleNumber = base + extra;

  try {
    const url = `https://www.law.go.kr/DRF/lawService.do`;
    const response = await axios.get(url, {
      params: {
        OC: API_KEY,
        type: 'json',
        target: 'law',
        ID: LAW_ID,
      },
    });

    const parsed = response.data;
    const lawName = parsed?.Law?.법령명 || '';
    const 조문들 = normalizeArray(parsed?.Law?.조문단위);

    const formattedArticle = formatArticleNumber(articleNumber);

    const target = 조문들.find(j => {
      const 번호 = j?.조문번호;
      return 번호 && formatArticleNumber(번호) === formattedArticle;
    });

    if (!target) {
      return res.status(404).json({ error: `요청한 조문(${articleNumber})을 찾을 수 없습니다.` });
    }

    const result = {
      lawName,
      articleNumber,
      articleTitle: extractText(target.조문제목) || `제${articleNumber}조`,
      articleContent: buildArticleContent(target),
    };

    res.json(result);
  } catch (err) {
    console.error('API 호출 오류:', err.message);
    res.status(500).json({ error: '외부 API 호출 중 오류가 발생했습니다.' });
  }
});

function formatArticleNumber(input) {
  return input.replace(/^0+/, '').replace(/[^\d의]/g, '');
}

function buildArticleContent(조문) {
  let content = '';
  if (조문.조문내용) content += extractText(조문.조문내용) + '\n';

  const 항들 = normalizeArray(조문.항);
  for (const 항 of 항들) {
    content += `\n${extractText(항.항번호)} ${extractText(항.항내용)}\n`;

    const 호들 = normalizeArray(항.호);
    for (const 호 of 호들) {
      const 호번호 = extractText(호.호번호);
      const 호가지번호 = extractText(호.호가지번호);
      const 호내용 = extractText(호.호내용);
      const 호제목 = 호가지번호 ? `${호번호}의${호가지번호}` : 호번호;
      content += `  ${호제목} ${호내용}\n`;

      const 목들 = normalizeArray(호.목);
      for (const 목 of 목들) {
        content += `    ${extractText(목.목번호)} ${extractText(목.목내용)}\n`;
      }
    }
  }

  return content.trim();
}

function extractText(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val._ || val['#cdata-section'] || '';
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

app.listen(PORT, () => {
  console.log(`✅ 프록시 서버 실행 중: http://localhost:${PORT}`);
});
