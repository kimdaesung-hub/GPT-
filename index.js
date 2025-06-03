const express = require("express");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Hello from proxy server!");
});

app.get("/law", async (req, res) => {
  const lawId = req.query.id;
  const article = req.query.article;

  if (!lawId || !article) {
    return res.status(400).json({ error: "id와 article 쿼리 파라미터가 필요합니다." });
  }

  try {
    const url = `https://www.law.go.kr/DRF/lawService.do?OC=nexpw&target=law&type=json&ID=${lawId}`;
    const response = await axios.get(url);
    const data = response.data;

    const articles = data.조문;
    const found = articles.find(item => item.조문번호 == article);

    if (!found) {
      return res.status(404).json({ error: `${article}조를 찾을 수 없습니다.` });
    }

    return res.json({
      법령명: data.법령명_한글,
      조문번호: found.조문번호,
      조문제목: found.조문제목,
      조문내용: found.조문내용
    });

  } catch (error) {
    return res.status(500).json({ error: "조회 실패", detail: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
