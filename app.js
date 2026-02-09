const searchForm = document.getElementById("search-form");
const searchResults = document.getElementById("search-results");
const confirmation = document.getElementById("confirmation");
const fetchPostsButton = document.getElementById("fetch-posts");
const postsContainer = document.getElementById("posts");
const postCountSelect = document.getElementById("post-count");

const networkInputs = {
  x: document.getElementById("x-handle"),
  instagram: document.getElementById("instagram-id"),
  facebook: document.getElementById("facebook-id"),
  linkedin: document.getElementById("linkedin-id"),
};

const networkLabels = {
  x: "X (Twitter)",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
};

let selectedProfile = null;

const renderError = (message) => {
  postsContainer.innerHTML = `
    <div class="error-banner">
      <strong>Não foi possível carregar.</strong>
      <p>${message}</p>
    </div>
  `;
};

const mockResults = (query) => [
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

const createResultCard = (result) => {
  const container = document.createElement("div");
  container.className = "result-item";

  container.innerHTML = `
    <h3>${result.name}</h3>
    <p class="result-meta">${result.description}</p>
    <p class="result-meta">${result.location}</p>
  `;

  const selectButton = document.createElement("button");
  selectButton.type = "button";
  selectButton.textContent = "Confirmar perfil";
  selectButton.addEventListener("click", () => {
    selectedProfile = result;
    updateConfirmation();
  });

  container.appendChild(selectButton);
  return container;
};

const updateConfirmation = () => {
  if (!selectedProfile) {
    confirmation.className = "confirmation muted";
    confirmation.innerHTML =
      "<p>Realize a busca inicial para confirmar a identidade.</p>";
    fetchPostsButton.disabled = true;
    return;
  }

  confirmation.className = "confirmation active";
  confirmation.innerHTML = `
    <h3>${selectedProfile.name}</h3>
    <p class="result-meta">${selectedProfile.description}</p>
    <p class="result-meta">${selectedProfile.location}</p>
    <button type="button" id="reset-profile">Alterar perfil</button>
  `;

  confirmation.querySelector("#reset-profile").addEventListener("click", () => {
    selectedProfile = null;
    updateConfirmation();
    postsContainer.innerHTML = "";
  });

  fetchPostsButton.disabled = false;
};

const buildPostCard = (networkKey, post, index) => {
  const card = document.createElement("article");
  card.className = "post-card";

  card.innerHTML = `
    <span class="network-tag">${networkLabels[networkKey]}</span>
    <h3>${selectedProfile.name} · Atualização ${index + 1}</h3>
    <p>${post.content}</p>
    <p class="post-meta">${post.source} · ${post.publishedAt}</p>
  `;

  return card;
};

const loadSearchResults = async (query) => {
  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error("Falha ao buscar perfis.");
    }

    const data = await response.json();
    return data.results;
  } catch (error) {
    return mockResults(query);
  }
};

const renderPosts = (data) => {
  postsContainer.innerHTML = "";

  Object.entries(data).forEach(([networkKey, payload]) => {
    if (payload.error) {
      const errorCard = document.createElement("article");
      errorCard.className = "post-card";
      errorCard.innerHTML = `
        <span class="network-tag">${networkLabels[networkKey]}</span>
        <p class="result-meta">${payload.error}</p>
      `;
      postsContainer.appendChild(errorCard);
      return;
    }

    payload.posts.forEach((post, index) => {
      postsContainer.appendChild(buildPostCard(networkKey, post, index));
    });
  });
};

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(searchForm);
  const query = formData.get("query").toString().trim();

  if (!query) {
    return;
  }

  selectedProfile = null;
  updateConfirmation();
  postsContainer.innerHTML = "";

  searchResults.innerHTML = "";
  const results = await loadSearchResults(query);
  results.forEach((result) => {
    searchResults.appendChild(createResultCard(result));
  });

  searchResults.classList.remove("hidden");
});

fetchPostsButton.addEventListener("click", async () => {
  if (!selectedProfile) {
    return;
  }

  const handles = {
    x: networkInputs.x.value.trim(),
    instagram: networkInputs.instagram.value.trim(),
    facebook: networkInputs.facebook.value.trim(),
    linkedin: networkInputs.linkedin.value.trim(),
  };

  try {
    const response = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: selectedProfile,
        count: Number(postCountSelect.value),
        handles,
      }),
    });

    if (!response.ok) {
      throw new Error("Erro ao consultar as redes sociais.");
    }

    const data = await response.json();
    renderPosts(data.networks);
  } catch (error) {
    renderError(
      "Confira se o servidor está rodando e se os tokens das redes sociais foram configurados."
    );
  }
});

updateConfirmation();
