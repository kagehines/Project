/* MiniSocial prototype
   - Stores everything in localStorage
   - Features: posts, image upload (dataURL), search, like, comment, follow, profile edit, notifications, simple analytics
   - Monetization features are mock / placeholder only.
*/

/* ---------- Utilities ---------- */
const uid = () => Math.random().toString(36).slice(2,9);
const q = sel => document.querySelector(sel);
const on = (sel,ev,fn) => q(sel).addEventListener(ev,fn);
const todayISO = () => new Date().toISOString();

/* ---------- State & Persistence ---------- */
const STORAGE_KEY = 'minisocial_v1';
let store = {
  me: {
    id: 'me',
    name: 'You',
    bio: 'Tell people about yourself.',
    avatar: '', // dataURL
    following: []
  },
  users: {},
  posts: [], // newest first
  notifications: []
};

function load(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try { store = JSON.parse(raw); }
    catch(e){ console.warn('corrupt store, resetting'); localStorage.removeItem(STORAGE_KEY); }
  } else {
    // create example users/posts
    const u1 = {id: 'u1', name:'ChefMia', bio:'Recipes & vibes', avatar:'', following:[]};
    const u2 = {id: 'u2', name:'ArtByLex', bio:'digital art', avatar:'', following:[]};
    store.users[u1.id]=u1; store.users[u2.id]=u2;
    store.posts.unshift(
      {id:uid(), userId:u1.id, text:'Quick pancake hack! #food', image:'', likes:5, comments:[], createdAt:todayISO()},
      {id:uid(), userId:u2.id, text:'New drawing — feedback welcome #art', image:'', likes:8, comments:[], createdAt:todayISO()}
    );
    persist();
  }
  renderAll();
}

function persist(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

/* ---------- Rendering ---------- */

function renderAll(){
  renderProfile();
  renderLeftProfile();
  renderFeed();
  renderSuggestions();
  renderTrending();
  renderStats();
  renderNotifBadge();
}

function renderProfile(){
  q('#profileName').textContent = store.me.name;
  q('#profileAvatar').src = store.me.avatar || defaultAvatar(store.me.name);
}

function renderLeftProfile(){
  q('#leftName').textContent = store.me.name;
  q('#leftBio').textContent = store.me.bio;
  q('#leftAvatar').src = store.me.avatar || defaultAvatar(store.me.name);
}

function defaultAvatar(name){
  // simple placeholder using dataURL svg
  const initials = (name||'U').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='100%' height='100%' fill='#0f1724'/><text x='50%' y='55%' font-size='72' fill='#6ee7b7' text-anchor='middle' dominant-baseline='middle' font-family='sans-serif'>${initials}</text></svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

function findUser(id){
  if(id==='me') return store.me;
  return store.users[id] || {id, name:'Unknown', avatar: defaultAvatar('Unknown'), bio:''};
}

function renderFeed(filter = ''){
  const feed = q('#feed');
  feed.innerHTML = '';
  const posts = store.posts.filter(p => {
    if(!filter) return true;
    const t = (p.text + ' ' + findUser(p.userId).name).toLowerCase();
    return t.includes(filter.toLowerCase());
  });
  posts.forEach(p => feed.appendChild(createPostCard(p)));
}

function createPostCard(p){
  const el = document.createElement('article');
  el.className = 'post-card';
  el.dataset.id = p.id;
  const user = findUser(p.userId);
  el.innerHTML = `
    <div class="post-header">
      <img src="${user.avatar || defaultAvatar(user.name)}" />
      <div>
        <div style="font-weight:700">${user.name} <span style="font-weight:400;color:var(--muted);font-size:13px">· ${timeAgo(p.createdAt)}</span></div>
        <div style="font-size:13px;color:var(--muted)">${user.bio}</div>
      </div>
    </div>
    <div class="post-body">
      <div class="post-text">${escapeHtml(p.text)}</div>
      ${p.image ? `<img class="post-img" src="${p.image}" />` : ''}
      <div class="post-actions">
        <button class="icon-btn like-btn">❤️ <span class="like-count">${p.likes||0}</span></button>
        <button class="icon-btn comment-toggle">💬 Comment</button>
        <button class="icon-btn follow-btn">${store.me.following.includes(p.userId) ? 'Unfollow' : 'Follow'}</button>
        <button class="icon-btn share-btn">🔗 Share</button>
      </div>
      <div class="comment-area" style="display:none">
         <div class="comments-list"></div>
         <div class="comment-box">
           <input class="comment-input" placeholder="Write a comment..." />
           <button class="comment-send icon-btn">Send</button>
         </div>
      </div>
    </div>
  `;
  // event wiring
  el.querySelector('.like-btn').onclick = () => {
    p.likes = (p.likes||0) + 1;
    addNotification({id:uid(), text:`${store.me.name} liked a post by ${user.name}`, read:false, time:todayISO()});
    persist(); renderAll();
  };
  el.querySelector('.comment-toggle').onclick = () => {
    const area = el.querySelector('.comment-area');
    area.style.display = area.style.display === 'none' ? 'block' : 'none';
  };
  el.querySelector('.follow-btn').onclick = () => {
    if(store.me.following.includes(p.userId)){
      store.me.following = store.me.following.filter(x=>x!==p.userId);
    } else {
      store.me.following.push(p.userId);
      addNotification({id:uid(), text:`${store.me.name} followed ${user.name}`, read:false, time:todayISO()});
    }
    persist(); renderAll();
  };
  el.querySelector('.share-btn').onclick = () => {
    // copy mock link
    const link = `https://minisocial.local/post/${p.id}`;
    navigator.clipboard?.writeText(link).then(()=> alert('Link copied: '+link), ()=>alert('Copy failed'));
  };

  const commentsList = el.querySelector('.comments-list');
  function refreshComments(){
    commentsList.innerHTML = '';
    (p.comments || []).forEach(c => {
      const d = document.createElement('div');
      d.style.padding='6px 0'; d.style.borderBottom='1px dashed rgba(255,255,255,0.02)';
      d.innerHTML = `<strong>${escapeHtml(c.by)}</strong> <span style="color:var(--muted);font-size:12px">· ${timeAgo(c.at)}</span><div>${escapeHtml(c.text)}</div>`;
      commentsList.appendChild(d);
    });
  }
  refreshComments();

  el.querySelector('.comment-send').onclick = () => {
    const input = el.querySelector('.comment-input');
    const txt = input.value.trim();
    if(!txt) return;
    p.comments = p.comments || [];
    p.comments.push({id:uid(), by: store.me.name, text: txt, at: todayISO()});
    input.value = '';
    addNotification({id:uid(), text:`${store.me.name} commented on ${user.name}'s post`, read:false, time:todayISO()});
    persist(); renderAll();
  };

  return el;
}

/* ---------- UI interactions ---------- */
on('#newPostBtn','click',()=> q('#modal').classList.remove('hidden'));
on('#closeModal','click',()=> q('#modal').classList.add('hidden'));
on('#publishBtn','click', publishPost);

on('#editProfileBtn','click',()=> {
  q('#profileModal').classList.remove('hidden');
  q('#profileNameInput').value = store.me.name;
  q('#profileBioInput').value = store.me.bio;
});
on('#closeProfileModal','click',()=> q('#profileModal').classList.add('hidden'));
on('#saveProfileBtn','click', saveProfile);

on('#searchInput','input', e => renderFeed(e.target.value));

on('#tipsBtn','click', ()=> {
  alert('Tip button added to your profile (mock). To accept real tips, ask a parent to connect a real payment processor and follow platform rules.');
  // add a mock flag we could render later
  store.me.tipsEnabled = true; persist(); renderAll();
});

on('#shopBtn','click', ()=> {
  alert('Shop created (mock). You can sell digital items — get parental help to accept payments.');
  store.me.shopEnabled = true; persist(); renderAll();
});

on('#subscribeBtn','click', ()=> {
  alert('Subscription enabled (mock). Real subscriptions need a payment platform and parental permission.');
  store.me.subEnabled = true; persist(); renderAll();
});

/* ---------- Posting flow (image using dataURL) ---------- */
function publishPost(){
  const text = q('#postText').value.trim();
  const file = q('#postImage').files[0];
  if(!text && !file){ alert('Write something or add an image'); return; }
  if(file){
    const reader = new FileReader();
    reader.onload = e => {
      createPost(text, e.target.result);
      q('#modal').classList.add('hidden');
      q('#postText').value=''; q('#postImage').value='';
    };
    reader.readAsDataURL(file);
  } else {
    createPost(text, '');
    q('#modal').classList.add('hidden');
    q('#postText').value='';
  }
}

function createPost(text, image){
  const p = {
    id: uid(),
    userId: 'me',
    text,
    image,
    likes: 0,
    comments: [],
    createdAt: todayISO()
  };
  store.posts.unshift(p);
  persist();
  addNotification({id:uid(), text:'Post published', read:false, time:todayISO()});
  renderAll();
}

/* ---------- Profile editing ---------- */
on('#profileAvatarInput','change', e => {
  const f = e.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = ev => {
    q('#leftAvatar').src = ev.target.result;
  };
  r.readAsDataURL(f);
});

function saveProfile(){
  const name = q('#profileNameInput').value.trim();
  const bio = q('#profileBioInput').value.trim();
  if(name) store.me.name = name;
  if(bio) store.me.bio = bio;
  // handle avatar input
  const f = q('#profileAvatarInput').files[0];
  if(f){
    const r = new FileReader();
    r.onload = ev => {
      store.me.avatar = ev.target.result;
      persist(); renderAll();
      q('#profileModal').classList.add('hidden');
    };
    r.readAsDataURL(f);
  } else {
    persist(); renderAll(); q('#profileModal').classList.add('hidden');
  }
}

/* ---------- Notifications ---------- */
function addNotification(n){
  store.notifications = store.notifications || [];
  store.notifications.unshift(n);
  // keep limit
  store.notifications = store.notifications.slice(0,50);
  persist();
}

function renderNotifBadge(){
  const unread = (store.notifications||[]).filter(n=>!n.read).length;
  q('#notifBadge').textContent = unread;
}

/* ---------- Suggestions, Trending, Stats ---------- */
function renderSuggestions(){
  const el = q('#suggestList'); el.innerHTML = '';
  const ids = Object.keys(store.users).slice(0,6);
  ids.forEach(id => {
    const user = store.users[id];
    const d = document.createElement('div');
    d.className = 'user';
    d.innerHTML = `<div style="display:flex;align-items:center;gap:8px"><img src="${user.avatar||defaultAvatar(user.name)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover" /><div><strong>${user.name}</strong><div style="font-size:12px;color:var(--muted)">${user.bio}</div></div></div><button class="icon-btn follow-sug">${store.me.following.includes(user.id)?'Unfollow':'Follow'}</button>`;
    d.querySelector('.follow-sug').onclick = () => {
      if(store.me.following.includes(user.id)) store.me.following = store.me.following.filter(x=>x!==user.id);
      else store.me.following.push(user.id);
      persist(); renderAll();
    };
    el.appendChild(d);
  });
}

function renderTrending(){
  const tags = {};
  store.posts.forEach(p => {
    const matches = (p.text || '').match(/#\w+/g) || [];
    matches.forEach(t => tags[t.toLowerCase()] = (tags[t.toLowerCase()]||0)+1);
  });
  const arr = Object.entries(tags).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const wrap = q('#tagsList'); wrap.innerHTML = '';
  arr.forEach(([t,c]) => {
    const b = document.createElement('div'); b.className='tag'; b.textContent=`${t} · ${c}`;
    b.onclick = ()=> renderFeed(t.replace('#',''));
    wrap.appendChild(b);
  });
}

function renderStats(){
  const st = q('#statsArea'); st.innerHTML = '';
  const totalPosts = store.posts.length;
  const totalLikes = store.posts.reduce((s,p)=>s + (p.likes||0),0);
  const totalFollowers = store.me.following.length;
  st.innerHTML = `<div class="stats-item"><div>Posts</div><div>${totalPosts}</div></div>
                  <div class="stats-item"><div>Total likes</div><div>${totalLikes}</div></div>
                  <div class="stats-item"><div>Following</div><div>${totalFollowers}</div></div>`;
}

/* ---------- Small helpers ---------- */
function escapeHtml(s){ return s ? s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) : ''; }
function timeAgo(iso){
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff/1000);
  if(s<60) return s + 's';
  const m = Math.floor(s/60);
  if(m<60) return m + 'm';
  const h = Math.floor(m/60);
  if(h<24) return h + 'h';
  const d = Math.floor(h/24);
  return d + 'd';
}

/* ---------- Initialize ---------- */
load();

/* ---------- Extra: export/import data for backups ---------- */
window.exportData = () => {
  const data = JSON.stringify(store, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'minisocial-backup.json'; a.click();
  URL.revokeObjectURL(url);
};
window.importData = (json) => {
  try{
    const obj = JSON.parse(json);
    store = obj; persist(); renderAll(); alert('Imported');
  } catch(e){ alert('Import failed'); }
};
