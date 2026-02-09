import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const safeJson = async (response) => {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
};

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString("pt-BR");
};

const buildPostPayload = (content, source, publishedAt) => ({
  content,
  source,
  publishedAt: formatDate(publishedAt),
});

const fetchXPosts = async (username, count) => {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    return { error: "Token do X não configurado (X_BEARER_TOKEN)." };
  }
  if (!username) {
    return { error: "Informe o usuário do X para buscar posts." };
  }

  const endpoint = new URL("https://api.twitter.com/2/tweets/search/recent");
  endpoint.searchParams.set("query", `from:${username}`);
  endpoint.searchParams.set("max_results", count.toString());
  endpoint.searchParams.set("tweet.fields", "created_at");

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return { error: "Falha ao consultar o X. Verifique o token e permissões." };
  }

  const data = await safeJson(response);
  const posts = (data.data || []).map((tweet) =>
    buildPostPayload(
      tweet.text,
      `https://x.com/${username}/status/${tweet.id}`,
      tweet.created_at
    )
  );

  return { posts };
};

const fetchInstagramPosts = async (userId, count) => {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    return { error: "Token do Instagram não configurado (INSTAGRAM_ACCESS_TOKEN)." };
  }
  if (!userId) {
    return { error: "Informe o user ID do Instagram para buscar posts." };
  }

  const endpoint = new URL(`https://graph.instagram.com/${userId}/media`);
  endpoint.searchParams.set("fields", "id,caption,permalink,timestamp");
  endpoint.searchParams.set("access_token", token);
  endpoint.searchParams.set("limit", count.toString());

  const response = await fetch(endpoint);
  if (!response.ok) {
    return { error: "Falha ao consultar o Instagram. Verifique o token e user ID." };
  }

  const data = await safeJson(response);
  const posts = (data.data || []).map((media) =>
    buildPostPayload(
      media.caption || "Post sem legenda.",
      media.permalink || "",
      media.timestamp
    )
  );

  return { posts };
};

const fetchFacebookPosts = async (pageId, count) => {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) {
    return { error: "Token do Facebook não configurado (FACEBOOK_ACCESS_TOKEN)." };
  }
  if (!pageId) {
    return { error: "Informe o Page ID do Facebook para buscar posts." };
  }

  const endpoint = new URL(`https://graph.facebook.com/v19.0/${pageId}/posts`);
  endpoint.searchParams.set("fields", "message,permalink_url,created_time");
  endpoint.searchParams.set("access_token", token);
  endpoint.searchParams.set("limit", count.toString());

  const response = await fetch(endpoint);
  if (!response.ok) {
    return { error: "Falha ao consultar o Facebook. Verifique o token e page ID." };
  }

  const data = await safeJson(response);
  const posts = (data.data || []).map((item) =>
    buildPostPayload(
      item.message || "Post sem texto.",
      item.permalink_url || "",
      item.created_time
    )
  );

  return { posts };
};

const fetchLinkedInPosts = async (organizationId, count) => {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) {
    return { error: "Token do LinkedIn não configurado (LINKEDIN_ACCESS_TOKEN)." };
  }
  if (!organizationId) {
    return { error: "Informe o Organization ID do LinkedIn para buscar posts." };
  }

  const endpoint = new URL("https://api.linkedin.com/v2/shares");
  endpoint.searchParams.set("q", "owners");
  endpoint.searchParams.set("owners", `urn:li:organization:${organizationId}`);
  endpoint.searchParams.set("count", count.toString());

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });

  if (!response.ok) {
    return { error: "Falha ao consultar o LinkedIn. Verifique o token e org ID." };
  }

  const data = await safeJson(response);
  const posts = (data.elements || []).map((item) => {
    const content =
      item.text?.text || "Post sem texto disponível no LinkedIn API.";
    return buildPostPayload(content, "https://www.linkedin.com", item.created?.time);
  });

  return { posts };
};

app.post("/api/search", (req, res) => {
  const query = (req.body.query || "").toString().trim();
  if (!query) {
    return res.status(400).json({ error: "Consulta inválida." });
  }

  const results = [
    {
      name: query,
      description: "Perfil oficial com atividade frequente.",
      location: "São Paulo · Brasil",
    },
    {
      name: `${query} (fanpage)`,
      description: "Página de fãs com publicações ocasionais.",
      location: "Rio de Janeiro · Brasil",
    },
    {
      name: `${query} Global`,
      description: "Subsidiária internacional com alcance global.",
      location: "Lisboa · Portugal",
    },
  ];

  return res.json({ results });
});

app.post("/api/posts", async (req, res) => {
  const count = Number(req.body.count) || 3;
  const safeCount = Math.min(Math.max(count, 1), 5);
  const handles = req.body.handles || {};

  try {
    const [x, instagram, facebook, linkedin] = await Promise.all([
      fetchXPosts(handles.x, safeCount),
      fetchInstagramPosts(handles.instagram, safeCount),
      fetchFacebookPosts(handles.facebook, safeCount),
      fetchLinkedInPosts(handles.linkedin, safeCount),
    ]);

    return res.json({
      networks: {
        x,
        instagram,
        facebook,
        linkedin,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao consultar as redes sociais." });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado em http://localhost:${PORT}`);
});
