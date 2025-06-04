// index.js
// 프록시 서버: 국가법령정보 API에서 전체 법령(JSON)을 받아온 뒤,
// 요청한 "조문번호"에 해당하는 조문만 골라서 반환합니다.

import express from 'express';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

// 실제로 발급받은 OC 값을 설정합니다.
const OC_VALUE = 'nexpw';

// 국가법령정보 API의 HTTPS 엔드포인트
const lawApiUrl = 'https://www.law.go.kr/DRF/lawService.do';

// 특정 조문번호와 JSON 내부 객체의 조문번호가 같은지 확인하는 헬퍼 함수
function isSameArticleNumber(targetNum, itemNum) {
  return String(targetNum).trim() === String(itemNum).trim();
}

app.get('/law', async (req, res) => {
  try {
    const { id, article } = req.query;

    // 필수 파라미터(id, article) 체크
    if (!id || !article) {
      return res.status(400).json({
        error: 'id(법령 ID)와 article(조문번호) 쿼리 파라미터를 모두 전달해야 합니다.'
      });
    }

    // 국가법령정보 API 호출 파라미터 준비
    const params = {
      OC: OC_VALUE,
      target: 'law',
      type: 'JSON',
      ID: id
    };

    // 전체 법령(JSON) 데이터 가져오기
    const response = await axios.get(lawApiUrl, { params });
    const data = response.data;

    if (!data || typeof data !== 'object') {
      return res.status(500).json({ error: '법령 정보 조회 응답이 비정상적입니다.' });
    }

    // JSON에서 법령 루트 객체 찾기
    const lawRoot = data.Law ?? data.law ?? null;
    if (!lawRoot) {
      return res.status(404).json({ error: '응답에서 법령 정보(Law)가 존재하지 않습니다.' });
    }

    // 조문 배열(JSON 키명은 실제 응답 구조에 맞춰 수정할 수 있습니다)
    const articlesArray = lawRoot['조문번호'];
    if (!Array.isArray(articlesArray)) {
      return res.status(500).json({ error: '법령 JSON 내부에 조문 배열을 찾을 수 없습니다.' });
    }

    // 요청된 조문번호(article)와 일치하는 객체 찾기
    const matched = articlesArray.find(entry =>
      isSameArticleNumber(article, entry.조문번호)
    );

    if (!matched) {
      return res.status(404).json({ error: `법령 ID ${id} 내에 조문번호 '${article}'을(를) 찾을 수 없습니다.` });
    }

    // 반환할 형식으로 가공
    const result = {
      lawName: lawRoot['법령명_한글'] || lawRoot['법령명'] || 'Unknown',
      articleNumber: `제${matched.조문번호}조`,
      articleTitle: matched.조문제목 || '',
      articleText: matched.조문내용 || ''
    };

    return res.json(result);

  } catch (e) {
    console.error('Error in /law handler:', e.response?.data || e.message);
    return res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server is running on http://localhost:${PORT}`);
});
