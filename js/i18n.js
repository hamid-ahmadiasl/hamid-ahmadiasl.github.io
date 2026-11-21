/* Site language: English, Persian (RTL), Italian and Finnish.
   English remains the HTML source for SEO and no-JS visitors.
   A tiny inline script in <head> sets lang/dir before first paint. */
(function (global) {
  'use strict';

  var STORAGE = 'ha-lang';
  var SUPPORTED = { en: 1, fa: 1, it: 1, fi: 1 };

  function detect() {
    try {
      var params = new URLSearchParams(location.search);
      var q = (params.get('lang') || '').toLowerCase();
      if (SUPPORTED[q]) return q;
      var stored = (localStorage.getItem(STORAGE) || '').toLowerCase();
      if (SUPPORTED[stored]) return stored;
      var nav = String(navigator.language || navigator.userLanguage || '').toLowerCase().split(/[-_]/)[0];
      if (SUPPORTED[nav]) return nav;
    } catch (e) { /* ignore */ }
    return 'en';
  }

  function t(lang, key) {
    var pack = (DICT[lang] && DICT[lang][key]) || (DICT.en && DICT.en[key]);
    return pack == null ? '' : pack;
  }

  function setDocumentLang(lang) {
    var html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'fa' ? 'rtl' : 'ltr';
    html.setAttribute('data-lang', lang);
  }

  function apply(lang) {
    lang = SUPPORTED[lang] ? lang : detect();
    setDocumentLang(lang);
    var nodes = document.querySelectorAll('[data-i18n], [data-i18n-html], [data-i18n-attr], [data-i18n-aria-prefix]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-i18n');
      if (key) {
        var val = t(lang, key);
        if (val) el.textContent = val;
      }
      var htmlKey = el.getAttribute('data-i18n-html');
      if (htmlKey) {
        var htmlVal = t(lang, htmlKey);
        if (htmlVal) el.innerHTML = htmlVal;
      }
      var attrSpec = el.getAttribute('data-i18n-attr');
      if (attrSpec) {
        attrSpec.split(',').forEach(function (pair) {
          var parts = pair.split(':');
          if (parts.length < 2) return;
          var attr = parts[0].trim();
          var aKey = parts.slice(1).join(':').trim();
          var aVal = t(lang, aKey);
          if (aVal) el.setAttribute(attr, aVal);
        });
      }
      var prefixKey = el.getAttribute('data-i18n-aria-prefix');
      if (prefixKey) {
        var original = el.getAttribute('data-aria-rest') || '';
        if (!original) {
          var current = el.getAttribute('aria-label') || '';
          var cut = current.indexOf(':');
          original = cut >= 0 ? current.slice(cut + 1).trim() : current;
          el.setAttribute('data-aria-rest', original);
        }
        var prefix = t(lang, prefixKey) || prefixKey;
        el.setAttribute('aria-label', original ? prefix + ': ' + original : prefix);
      }
    }
    var btns = document.querySelectorAll('[data-set-lang]');
    for (var j = 0; j < btns.length; j++) {
      var on = btns[j].getAttribute('data-set-lang') === lang;
      btns[j].setAttribute('aria-pressed', on ? 'true' : 'false');
      btns[j].classList.toggle('is-active', on);
    }

    /* Keep Latin "Hamid Ahmadi Asl" in EN/IT/FI; swap visible + meta copies in FA. */
    var nameEn = 'Hamid Ahmadi Asl';
    var nameLoc = t(lang, 'name.full') || nameEn;
    var metas = document.querySelectorAll('meta[content]');
    for (var mi = 0; mi < metas.length; mi++) {
      var m = metas[mi];
      if (m.hasAttribute('data-i18n-attr')) continue; /* already translated as a whole */
      var src = m.getAttribute('data-i18n-src');
      if (src == null) {
        src = m.getAttribute('content') || '';
        m.setAttribute('data-i18n-src', src);
      }
      if (src.indexOf(nameEn) !== -1) m.setAttribute('content', src.split(nameEn).join(nameLoc));
    }

    document.documentElement.classList.remove('i18n-pending');
  }

  function setLang(lang, opts) {
    opts = opts || {};
    if (!SUPPORTED[lang]) return;
    try { localStorage.setItem(STORAGE, lang); } catch (e) { /* ignore */ }
    try {
      var url = new URL(location.href);
      url.searchParams.set('lang', lang);
      if (opts.replace !== false) history.replaceState({}, '', url);
    } catch (e) { /* ignore */ }
    apply(lang);
    try {
      document.dispatchEvent(new CustomEvent('ha:langchange', { detail: { lang: lang } }));
    } catch (e) { /* ignore */ }
  }

  function bind() {
    document.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('[data-set-lang]');
      if (!btn) return;
      e.preventDefault();
      setLang(btn.getAttribute('data-set-lang'));
    });
  }

  var DICT = { en: {}, fa: {}, it: {}, fi: {} };

  function add(key, en, fa, it) {
    DICT.en[key] = en;
    DICT.fa[key] = fa;
    DICT.it[key] = it;
    DICT.fi[key] = en;
  }

  add("title.home", "Hamid Ahmadi Asl · AI & Computational Science Researcher", "حمید احمدی‌اصل · پژوهشگر هوش مصنوعی و علوم محاسباتی", "Hamid Ahmadi Asl · Ricercatore in IA e scienza computazionale");
  add("title.education", "Education · Hamid Ahmadi Asl", "تحصیلات · حمید احمدی‌اصل", "Formazione · Hamid Ahmadi Asl");
  add("title.research", "Research · Hamid Ahmadi Asl", "پژوهش · حمید احمدی‌اصل", "Ricerca · Hamid Ahmadi Asl");
  add("title.patents", "Patents · Hamid Ahmadi Asl", "اختراعات · حمید احمدی‌اصل", "Brevetti · Hamid Ahmadi Asl");
  add("title.experience", "Experience · Hamid Ahmadi Asl", "تجربه کاری · حمید احمدی‌اصل", "Esperienza · Hamid Ahmadi Asl");
  add("title.skills", "Skills · Hamid Ahmadi Asl", "مهارت‌ها · حمید احمدی‌اصل", "Competenze · Hamid Ahmadi Asl");
  add("title.insights", "Insights · Hamid Ahmadi Asl", "مطالب آموزشی · حمید احمدی‌اصل", "Approfondimenti · Hamid Ahmadi Asl");
  add("title.honors", "Honors · Hamid Ahmadi Asl", "افتخارات · حمید احمدی‌اصل", "Riconoscimenti · Hamid Ahmadi Asl");
  add("title.contact", "Contact · Hamid Ahmadi Asl", "تماس · حمید احمدی‌اصل", "Contatti · Hamid Ahmadi Asl");
  add("title.404", "Page not found · Hamid Ahmadi Asl", "صفحه پیدا نشد · حمید احمدی‌اصل", "Pagina non trovata · Hamid Ahmadi Asl");
  add("nav.home", "Home", "خانه", "Home");
  add("nav.education", "Education", "تحصیلات", "Formazione");
  add("nav.research", "Research", "پژوهش", "Ricerca");
  add("nav.patents", "Patents", "اختراعات", "Brevetti");
  add("nav.experience", "Experience", "تجربه کاری", "Esperienza");
  add("nav.skills", "Skills", "مهارت‌ها", "Competenze");
  add("nav.insights", "Insights", "مطالب آموزشی", "Approfondimenti");
  add("nav.honors", "Honors", "افتخارات", "Riconoscimenti");
  add("nav.contact", "Contact", "تماس", "Contatti");
  add("nav.primary", "Primary", "منوی اصلی", "Principale");
  add("nav.toggle", "Toggle menu", "باز و بسته کردن منو", "Apri o chiudi il menu");
  add("nav.brand", "Hamid Ahmadi Asl — home", "حمید احمدی‌اصل — خانه", "Hamid Ahmadi Asl — home");
  add("lang.label", "Language", "زبان", "Lingua");
  add("skip", "Skip to content", "رفتن به محتوا", "Vai al contenuto");
  add("footer.top", "Back to top ↑", "بازگشت به بالا ↑", "Torna su ↑");
  add("footer.privacy", "This site records anonymous visit statistics and chat messages to improve responses; no IP addresses are stored.", "این سایت برای بهبود پاسخ‌ها، آمار بازدید و پیام‌های گفتگو را به‌صورت ناشناس ثبت می‌کند؛ نشانی IP ذخیره نمی‌شود.", "Questo sito registra statistiche di visita e messaggi della chat in forma anonima per migliorare le risposte; gli indirizzi IP non vengono memorizzati.");
  add("hero.eyebrow", "Engineering <span class=\"eyebrow__accent\">meets</span> AI", "مهندسی <span class=\"eyebrow__accent\">در تلاقی با</span> هوش مصنوعی", "L’ingegneria <span class=\"eyebrow__accent\">incontra</span> l’IA");
  add("hero.title", "AI & Computational Science Researcher with a Mechanical Engineering Background", "پژوهشگر هوش مصنوعی و علوم محاسباتی با پیش‌زمینه‌ی مهندسی مکانیک", "Ricercatore in intelligenza artificiale e scienza computazionale, con una formazione in ingegneria meccanica");
  add("hero.lead", "Bridging engineering knowledge and artificial intelligence to develop practical solutions for complex real-world problems. MSc student in Artificial Intelligence for Science and Technology at the University of Milano-Bicocca.", "پیوند دانش مهندسی و هوش مصنوعی برای توسعه‌ی راه‌حل‌های کاربردی در مسئله‌های پیچیده و واقعی. دانشجوی کارشناسی ارشد هوش مصنوعی برای علم و فناوری در دانشگاه میلانو-بیکوکا.", "Unisco conoscenze di ingegneria e intelligenza artificiale per sviluppare soluzioni pratiche a problemi reali complessi. Sono studente della laurea magistrale in Artificial Intelligence for Science and Technology presso l’Università degli Studi di Milano-Bicocca.");
  add("hero.quote", "“What excites me most is working on research where physics, engineering and artificial intelligence come together.”", "«آنچه بیش از همه برایم هیجان‌انگیز است، کار روی پژوهشی است که در آن فیزیک، مهندسی و هوش مصنوعی به هم می‌رسند.»", "«Quello che mi appassiona di più è lavorare a una ricerca in cui fisica, ingegneria e intelligenza artificiale si incontrano.»");
  add("cta.scholar", "Google Scholar", "Google Scholar", "Google Scholar");
  add("cta.linkedin", "LinkedIn", "LinkedIn", "LinkedIn");
  add("cta.github", "GitHub", "GitHub", "GitHub");
  add("cta.email", "Email", "ایمیل", "Email");
  add("about.kicker", "01 — About", "۰۱ — درباره‌ی من", "01 — Chi sono");
  add("about.heading", "Profile summary", "خلاصه‌ی پیشینه", "Profilo in breve");
  add("about.p1", "AI and computational science researcher with a mechanical engineering background, currently pursuing an MSc in Artificial Intelligence for Science and Technology at the University of Milano-Bicocca. I build machine-learning models for physical and engineering systems, using CFD and experimental data to train surrogate models, reconstruct flow fields and explore design spaces.", "پژوهشگر هوش مصنوعی و علوم محاسباتی با پیش‌زمینه‌ی مهندسی مکانیک، و دانشجوی کارشناسی ارشد هوش مصنوعی برای علم و فناوری در دانشگاه میلانو-بیکوکا. مدل‌های یادگیری ماشین را برای سامانه‌های فیزیکی و مهندسی می‌سازم و از دینامیک سیالات محاسباتی و داده‌های آزمایشگاهی برای آموزش مدل‌های جانشین، بازسازی میدان جریان و کاوش فضای طراحی استفاده می‌کنم.", "Ricercatore in intelligenza artificiale e scienza computazionale, con una formazione in ingegneria meccanica, attualmente iscritto alla laurea magistrale in Artificial Intelligence for Science and Technology presso l’Università degli Studi di Milano-Bicocca. Sviluppo modelli di apprendimento automatico per sistemi fisici e ingegneristici, usando CFD e dati sperimentali per addestrare modelli surrogati, ricostruire campi di flusso ed esplorare gli spazi di progetto.");
  add("about.p2", "My work sits where physics meets data: scientific machine learning, the data quality and generalization of small-sample surrogates, and data-driven design optimization. Years of R&D and industrial experience as a Project Sub-Leader (PSL) and Design Engineer, together with patents and peer-reviewed publications, keep my models grounded in what real engineering problems need.", "کارم در جایی است که فیزیک و داده به هم می‌رسند: یادگیری ماشین علمی، کیفیت داده و تعمیم‌پذیری مدل‌های جانشین با نمونه‌ی محدود، و بهینه‌سازی طراحی مبتنی بر داده. سال‌ها تجربه‌ی تحقیق‌وتوسعه و صنعتی به‌عنوان جانشین رهبر پروژه (PSL) و مهندس طراحی، در کنار اختراعات و مقالات داوری‌شده، مدل‌هایم را به نیازهای واقعی مهندسی نزدیک نگه می‌دارد.", "Il mio lavoro sta dove la fisica incontra i dati: machine learning scientifico, qualità dei dati e generalizzazione dei surrogati su campioni piccoli, e ottimizzazione progettuale basata sui dati. Anni di esperienza in ricerca e sviluppo e in ambito industriale come Project Sub-Leader (PSL) e Design Engineer, insieme a brevetti e pubblicazioni sottoposte a revisione, tengono i modelli ancorati a ciò che i problemi ingegneristici reali richiedono.");
  add("about.p3", "I'm driven by research that uses AI to accelerate scientific discovery and engineering design, and I regularly share training posts that explain ML and deep learning concepts.", "انگیزه‌ام پژوهشی است که با هوش مصنوعی، کشف علمی و طراحی مهندسی را تسریع کند؛ و به‌طور منظم مطالب آموزشی درباره‌ی یادگیری ماشین و یادگیری عمیق منتشر می‌کنم.", "Mi motiva la ricerca che usa l’IA per accelerare la scoperta scientifica e la progettazione ingegneristica, e condivido con regolarità post formativi che spiegano concetti di machine learning e deep learning.");
  add("stats.degrees", "Degrees", "مدارک تحصیلی", "Titoli di studio");
  add("stats.papers", "Journal papers", "مقالات علمی", "Articoli su rivista");
  add("stats.patents", "Patents", "اختراعات", "Brevetti");
  add("stats.book", "Published book", "کتاب منتشرشده", "Libro pubblicato");
  add("stats.aria", "At a glance", "در یک نگاه", "In sintesi");
  add("journey.heading", "My journey", "مسیر من", "Il mio percorso");
  add("journey.aria", "From mechanical engineering to scientific machine learning", "از مهندسی مکانیک تا یادگیری ماشین علمی", "Dall’ingegneria meccanica al machine learning scientifico");
  add("journey.1", "Mechanical Engineering", "مهندسی مکانیک", "Ingegneria meccanica");
  add("journey.2", "Fluid Mechanics", "مکانیک سیالات", "Meccanica dei fluidi");
  add("journey.3", "Numerical Simulation (CFD)", "شبیه‌سازی عددی (CFD)", "Simulazione numerica (CFD)");
  add("journey.4", "Experimental Research", "پژوهش آزمایشگاهی", "Ricerca sperimentale");
  add("journey.5", "Industrial R&D", "تحقیق‌وتوسعه‌ی صنعتی", "R&S industriale");
  add("journey.6", "Artificial Intelligence", "هوش مصنوعی", "Intelligenza artificiale");
  add("journey.7", "Scientific Machine Learning", "یادگیری ماشین علمی", "Machine learning scientifico");
  add("journey.note", "Each step has expanded my technical toolkit. My focus is turning engineering problems into practical, data-driven solutions.", "هر گام، ابزار فنی‌ام را گسترده‌تر کرده است. تمرکزم تبدیل مسئله‌های مهندسی به راه‌حل‌های کاربردی و مبتنی بر داده است.", "Ogni tappa ha ampliato il mio bagaglio tecnico. Il mio obiettivo è trasformare i problemi ingegneristici in soluzioni pratiche, guidate dai dati.");
  add("explore.kicker", "Explore", "کاوش", "Esplora");
  add("explore.heading", "A closer look", "نگاهی دقیق‌تر", "Uno sguardo più da vicino");
  add("explore.sub", "Jump into a section — each page has the same menu, theme and assistant.", "وارد هر بخش شوید — همه‌ی صفحه‌ها منو، ظاهر و دستیار یکسانی دارند.", "Entra in una sezione: ogni pagina ha lo stesso menu, lo stesso tema e lo stesso assistente.");
  add("explore.go", "Explore →", "مشاهده ←", "Esplora →");
  add("explore.education.p", "MSc AI4ST at UNIMIB, plus earlier mechanical engineering degrees.", "کارشناسی ارشد AI4ST در UNIMIB، به‌همراه مدارک پیشین مهندسی مکانیک.", "Laurea magistrale AI4ST all’UNIMIB, oltre a titoli precedenti in ingegneria meccanica.");
  add("explore.research.p", "A new paper on small-sample ML surrogates, plus journal articles and a book.", "مقاله‌ای تازه درباره‌ی مدل‌های جانشین یادگیری ماشین با نمونه‌ی محدود، به‌علاوه‌ی مقالات علمی و یک کتاب.", "Un nuovo articolo sui surrogati di machine learning a campione piccolo, oltre ad articoli su rivista e un libro.");
  add("explore.patents.p", "Two Iranian patents: a wind-velocity duct and a blower wind tunnel.", "دو اختراع ثبت‌شده در ایران: مجرای افزایش سرعت باد و تونل باد دمنده.", "Due brevetti iraniani: un condotto per aumentare la velocità del vento e una galleria del vento a soffiante.");
  add("explore.experience.p", "From mechanical design and CFD in industry to AI training and research.", "از طراحی مکانیکی و CFD در صنعت تا آموزش هوش مصنوعی و پژوهش.", "Dalla progettazione meccanica e dalla CFD in ambito industriale alla formazione e alla ricerca in IA.");
  add("explore.skills.p", "Python, machine learning, CFD, high-performance computing and engineering design.", "پایتون، یادگیری ماشین، CFD، رایانش با عملکرد بالا و طراحی مهندسی.", "Python, machine learning, CFD, calcolo ad alte prestazioni e progettazione ingegneristica.");
  add("explore.insights.p", "Short visual guides on AI, machine learning and AI for engineering.", "راهنماهای کوتاه و تصویری درباره‌ی هوش مصنوعی، یادگیری ماشین و کاربرد آن در مهندسی.", "Brevi guide visive su IA, machine learning e IA per l’ingegneria.");
  add("explore.honors.p", "Awards for the patented ducted turbine, a best-paper prize, and more.", "جایزه‌هایی برای توربین مجرا‌دار ثبت‌شده، جایزه‌ی بهترین مقاله، و موارد دیگر.", "Riconoscimenti per la turbina intubata brevettata, un premio per il miglior articolo e altro ancora.");
  add("explore.contact.p", "Email, LinkedIn, Google Scholar and GitHub — or chat with the site assistant.", "ایمیل، LinkedIn، Google Scholar و GitHub — یا گفتگو با دستیار سایت.", "Email, LinkedIn, Google Scholar e GitHub — oppure chatta con l’assistente del sito.");
  add("badge.new", "New", "تازه", "Nuovo");
  add("edu.kicker", "Education", "تحصیلات", "Formazione");
  add("edu.h1", "Academic <span class=\"grad\">background</span>", "پیشینه‌ی <span class=\"grad\">تحصیلی</span>", "Percorso <span class=\"grad\">accademico</span>");
  add("edu.sub", "From mechanical engineering to an MSc in Artificial Intelligence for Science and Technology at the University of Milano-Bicocca.", "از مهندسی مکانیک تا کارشناسی ارشد هوش مصنوعی برای علم و فناوری در دانشگاه میلانو-بیکوکا.", "Dall’ingegneria meccanica alla laurea magistrale in Artificial Intelligence for Science and Technology presso l’Università degli Studi di Milano-Bicocca.");
  add("edu.now", "2025 – Now", "2025 – اکنون", "2025 – oggi");
  add("edu.inprogress", "In progress", "در حال تحصیل", "In corso");
  add("edu.msc.ai.title", "Master of Artificial Intelligence for Science and Technology", "کارشناسی ارشد هوش مصنوعی برای علم و فناوری", "Laurea magistrale in Artificial Intelligence for Science and Technology");
  add("edu.msc.ai.place", "Department of Physics “Giuseppe Occhialini”, University of Milano-Bicocca, Milan, Italy.", "گروه فیزیک «جوزپه اوکیالینی»، دانشگاه میلانو-بیکوکا (Università degli Studi di Milano-Bicocca)، میلان، ایتالیا.", "Dipartimento di Fisica “Giuseppe Occhialini”, Università degli Studi di Milano-Bicocca, Milano, Italia.");
  add("edu.msc.me.title", "Master of Science in Mechanical Engineering — Energy Conversion", "کارشناسی ارشد مهندسی مکانیک — تبدیل انرژی", "Laurea magistrale in Ingegneria meccanica — Conversione dell’energia");
  add("edu.msc.me.place", "Department of Mechanical Engineering, South Tehran Branch, IAU, Tehran, Iran.", "گروه مهندسی مکانیک، واحد تهران جنوب، دانشگاه آزاد اسلامی، تهران، ایران.", "Dipartimento di Ingegneria meccanica, sede di Teheran Sud, IAU, Teheran, Iran.");
  add("edu.highlights", "Research highlights", "نکات برجسته‌ی پژوهش", "Punti salienti della ricerca");
  add("edu.hl1", "Built full-scale experimental systems", "ساخت سامانه‌های آزمایشگاهی در مقیاس کامل", "Realizzazione di sistemi sperimentali in scala reale");
  add("edu.hl2", "Validated CFD models experimentally", "اعتبارسنجی تجربی مدل‌های CFD", "Validazione sperimentale dei modelli CFD");
  add("edu.hl3", "Combined numerical and experimental methods", "ترکیب روش‌های عددی و آزمایشگاهی", "Integrazione di metodi numerici e sperimentali");
  add("edu.msc.me.note", "This work strengthened my ability to connect physical understanding, simulation and experimental evidence.", "این کار توانایی‌ام را در پیوند درک فیزیکی، شبیه‌سازی و شواهد آزمایشگاهی تقویت کرد.", "Questo lavoro ha rafforzato la mia capacità di collegare comprensione fisica, simulazione ed evidenza sperimentale.");
  add("edu.bsc.title", "Bachelor of Science in Mechanical Engineering — Heat and Fluids", "کارشناسی مهندسی مکانیک — حرارت و سیالات", "Laurea triennale in Ingegneria meccanica — Termofluidodinamica");
  add("edu.bsc.place", "Department of Mechanical Engineering, South Tehran Branch, IAU, Tehran, Iran.", "گروه مهندسی مکانیک، واحد تهران جنوب، دانشگاه آزاد اسلامی، تهران، ایران.", "Dipartimento di Ingegneria meccanica, sede di Teheran Sud, IAU, Teheran, Iran.");
  add("exp.kicker", "Experience", "تجربه کاری", "Esperienza");
  add("exp.h1", "Professional <span class=\"grad\">experience</span>", "تجربه‌ی <span class=\"grad\">حرفه‌ای</span>", "Esperienza <span class=\"grad\">professionale</span>");
  add("exp.sub", "Roles in AI training, project leadership, design engineering, and modelling and simulation.", "نقش‌هایی در آموزش هوش مصنوعی، رهبری پروژه، مهندسی طراحی، و مدل‌سازی و شبیه‌سازی.", "Ruoli nella formazione in IA, nella leadership di progetto, nella progettazione e nella modellazione e simulazione.");
  add("exp.now", "2026 – Now", "2026 – اکنون", "2026 – oggi");
  add("exp.r1.title", "AI Training Contributor", "همکار آموزش هوش مصنوعی", "Collaboratore per la formazione in IA");
  add("exp.r1.desc", "AI annotation; engineering-focused AI training and evaluation.", "حاشیه‌نویسی داده‌های هوش مصنوعی؛ آموزش و ارزیابی مدل‌ها با تمرکز مهندسی.", "Annotazione per l’IA; formazione e valutazione di sistemi di IA con un taglio ingegneristico.");
  add("exp.r2.title", "Project Sub-Leader (PSL)", "جانشین رهبر پروژه (PSL)", "Project Sub-Leader (PSL)");
  add("exp.r2.desc", "Coordinated engineers and resolved interdisciplinary engineering issues; allocated tasks, led meetings and prepared progress reports.", "هماهنگی مهندسان و حل مسئله‌های میان‌رشته‌ای مهندسی؛ تخصیص کارها، برگزاری جلسات و تهیه‌ی گزارش پیشرفت.", "Coordinamento degli ingegneri e risoluzione di questioni ingegneristiche interdisciplinari; assegnazione dei compiti, conduzione delle riunioni e preparazione dei rapporti di avanzamento.");
  add("exp.r3.title", "Design Engineer", "مهندس طراحی", "Ingegnere di progettazione");
  add("exp.r3.desc", "Designed stationary equipment; prepared Material Requisitions (MRs); performed Vendor Document Review (VDR).", "طراحی تجهیزات ثابت؛ تهیه‌ی درخواست مواد (MR)؛ بازبینی مدارک فروشنده (VDR).", "Progettazione di apparecchiature statiche; preparazione delle Material Requisition (MR); revisione della documentazione dei fornitori (VDR).");
  add("exp.r4.title", "Modeling and Simulation", "مدل‌سازی و شبیه‌سازی", "Modellazione e simulazione");
  add("exp.r4.desc", "Delivered numerical simulation and modeling across R&D and industrial projects.", "انجام شبیه‌سازی عددی و مدل‌سازی در پروژه‌های تحقیق‌وتوسعه و صنعتی.", "Simulazione numerica e modellazione su progetti di R&S e industriali.");
  add("exp.r5.title", "Simulation & Optimization Specialist", "متخصص شبیه‌سازی و بهینه‌سازی", "Specialista in simulazione e ottimizzazione");
  add("exp.r5.desc", "Performed numerical simulation and modeling; developed design concepts; coordinated project team members.", "انجام شبیه‌سازی عددی و مدل‌سازی؛ توسعه‌ی مفاهیم طراحی؛ هماهنگی اعضای تیم پروژه.", "Simulazione numerica e modellazione; sviluppo di concetti di progetto; coordinamento dei membri del gruppo di lavoro.");
  add("exp.r6.title", "Modeling and Simulation", "مدل‌سازی و شبیه‌سازی", "Modellazione e simulazione");
  add("exp.r6.desc", "Carried out project-based numerical simulation and modeling for R&D work.", "انجام شبیه‌سازی عددی و مدل‌سازی پروژه‌محور برای کار تحقیق‌وتوسعه.", "Simulazione numerica e modellazione su base progettuale per attività di R&S.");
  add("exp.r7.title", "Mechanical Engineer", "مهندس مکانیک", "Ingegnere meccanico");
  add("exp.r7.desc", "Performed mechanical calculations, numerical simulation and design evaluation; liaised with R&D partners.", "انجام محاسبات مکانیکی، شبیه‌سازی عددی و ارزیابی طراحی؛ ارتباط با شرکای تحقیق‌وتوسعه.", "Calcoli meccanici, simulazione numerica e valutazione del progetto; raccordo con i partner di R&S.");
  add("exp.tag.rdind", "R&D and Industry", "تحقیق‌وتوسعه و صنعت", "R&S e industria");
  add("exp.tag.rd", "R&D", "تحقیق‌وتوسعه", "R&S");
  add("exp.tag.industry", "Industry", "صنعت", "Industria");
  add("skills.kicker", "Skills", "مهارت‌ها", "Competenze");
  add("skills.h1", "Technical <span class=\"grad\">skills</span>", "مهارت‌های <span class=\"grad\">فنی</span>", "Competenze <span class=\"grad\">tecniche</span>");
  add("skills.sub", "Scientific computing, machine learning, CFD, high-performance computing, and engineering practice.", "محاسبات علمی، یادگیری ماشین، CFD، رایانش با عملکرد بالا، و کار مهندسی.", "Calcolo scientifico, machine learning, CFD, calcolo ad alte prestazioni e pratica ingegneristica.");
  add("skills.g.prog", "Programming & Scientific Computing", "برنامه‌نویسی و محاسبات علمی", "Programmazione e calcolo scientifico");
  add("skills.g.ml", "Machine Learning & Deep Learning", "یادگیری ماشین و یادگیری عمیق", "Machine learning e deep learning");
  add("skills.g.data", "Data & AI", "داده و هوش مصنوعی", "Dati e IA");
  add("skills.g.hpc", "High-Performance Computing", "رایانش با عملکرد بالا", "Calcolo ad alte prestazioni");
  add("skills.g.comp", "Computational Engineering", "مهندسی محاسباتی", "Ingegneria computazionale");
  add("skills.g.eng", "Engineering", "مهندسی", "Ingegneria");
  add("skills.core", "Core competencies", "شایستگی‌های اصلی", "Competenze chiave");
  add("skills.c1", "Mechanical & Engineering Design", "طراحی مکانیکی و مهندسی", "Progettazione meccanica e ingegneristica");
  add("skills.c2", "Numerical Simulation and CFD", "شبیه‌سازی عددی و CFD", "Simulazione numerica e CFD");
  add("skills.c3", "Design Optimization", "بهینه‌سازی طراحی", "Ottimizzazione del progetto");
  add("skills.c4", "Interdisciplinary Collaboration", "همکاری میان‌رشته‌ای", "Collaborazione interdisciplinare");
  add("skills.c5", "Project Coordination & Problem Solving", "هماهنگی پروژه و حل مسئله", "Coordinamento di progetto e problem solving");
  add("skills.course", "Current AI coursework", "درس‌های جاری هوش مصنوعی", "Corsi di IA in corso");
  add("skills.explore", "Areas I’m exploring", "زمینه‌هایی که در حال کاوش آن‌ها هستم", "Aree che sto esplorando");
  add("skills.flow.phys", "Physics", "فیزیک", "Fisica");
  add("skills.flow.eng", "Engineering", "مهندسی", "Ingegneria");
  add("skills.flow.ai", "AI", "هوش مصنوعی", "IA");
  add("skills.flow.end", "Intelligent Engineering Systems", "سامانه‌های مهندسی هوشمند", "Sistemi ingegneristici intelligenti");
  add("honors.kicker", "Honors & Awards", "افتخارات و جوایز", "Onorificenze e premi");
  add("honors.h1", "Recognition &amp; <span class=\"grad\">languages</span>", "قدردانی و <span class=\"grad\">زبان‌ها</span>", "Riconoscimenti e <span class=\"grad\">lingue</span>");
  add("honors.sub", "Awards for research and invention, plus language proficiency.", "جوایز پژوهش و اختراع، به‌همراه مهارت زبانی.", "Premi per la ricerca e l’invenzione, oltre alla competenza linguistica.");
  add("honors.a1", "Accreditation and scoring for commercialization of the patented ducted wind turbine by the “Scientific and Industrial Research Organization of Iran; Ministry of Science, Research and Technology”.", "اعتبارسنجی و امتیازدهی برای تجاری‌سازی توربین بادی مجرا‌دار ثبت‌شده، از سوی «سازمان پژوهش‌های علمی و صنعتی ایران؛ وزارت علوم، تحقیقات و فناوری».", "Accreditamento e valutazione per la commercializzazione della turbina eolica intubata brevettata da parte dell’«Organizzazione per la ricerca scientifica e industriale dell’Iran; Ministero della scienza, della ricerca e della tecnologia».");
  add("honors.a2", "Rewarded for the Best Paper of the year by South Tehran Branch, Azad University.", "دریافت جایزه‌ی بهترین مقاله‌ی سال از واحد تهران جنوب، دانشگاه آزاد اسلامی.", "Premio per il miglior articolo dell’anno assegnato dalla sede di Teheran Sud, Azad University.");
  add("honors.a3", "The Regional Selection of the Sixth Khwarizmi Youth Awards.", "انتخاب منطقه‌ای ششمین دوره‌ی جایزه‌ی جوان خوارزمی.", "Selezione regionale della sesta edizione dei Khwarizmi Youth Awards.");
  add("honors.view", "View document", "مشاهده‌ی مدرک", "Vedi il documento");
  add("honors.langs", "Languages", "زبان‌ها", "Lingue");
  add("honors.langprof", "Language proficiency", "مهارت زبانی", "Competenza linguistica");
  add("honors.en", "English", "انگلیسی", "Inglese");
  add("honors.en.score", "Overall band score: 7.0 · exam date 24 Oct 2024", "نمره‌ی کلی باند: 7.0 · تاریخ آزمون 24 Oct 2024", "Punteggio complessivo: 7.0 · data dell’esame 24 Oct 2024");
  add("honors.it", "Italian", "ایتالیایی", "Italiano");
  add("honors.it.level", "A1 · currently learning at A2 level", "A1 · در حال یادگیری در سطح A2", "A1 · attualmente in fase di apprendimento al livello A2");
  add("pat.kicker", "Patents", "اختراعات", "Brevetti");
  add("pat.h1", "Patented in <span class=\"grad\">Iran</span>", "ثبت‌شده در <span class=\"grad\">ایران</span>", "Brevettati in <span class=\"grad\">Iran</span>");
  add("pat.sub", "Two granted patents on wind-energy and wind-tunnel hardware.", "دو اختراع ثبت‌شده در زمینه‌ی انرژی باد و تجهیزات تونل باد.", "Due brevetti concessi su componenti per l’energia eolica e per gallerie del vento.");
  add("pat.no", "Patent No.", "شماره اختراع", "Brevetto n.");
  add("pat.iniran", "Patented in Iran", "ثبت‌شده در ایران", "Brevettato in Iran");
  add("pat.view", "View document", "مشاهده‌ی مدرک", "Vedi il documento");
  add("ins.kicker", "Training & Insights", "آموزش و مطالب", "Formazione e approfondimenti");
  add("ins.h1", "Visual guides &amp; <span class=\"grad\">posts</span>", "راهنماهای تصویری و <span class=\"grad\">نوشته‌ها</span>", "Guide visive e <span class=\"grad\">post</span>");
  add("ins.sub", "Short visual explainers on AI, machine learning and AI for engineering, shared on <a class=\"link\" href=\"http://www.linkedin.com/in/hamid-ahmadi-asl-bb3005ab\" target=\"_blank\" rel=\"noopener noreferrer\">LinkedIn <span aria-hidden=\"true\">↗</span></a>. Filter by topic below.", "توضیح‌های کوتاه و تصویری درباره‌ی هوش مصنوعی، یادگیری ماشین و کاربرد آن در مهندسی، منتشرشده در <a class=\"link\" href=\"http://www.linkedin.com/in/hamid-ahmadi-asl-bb3005ab\" target=\"_blank\" rel=\"noopener noreferrer\">LinkedIn <span aria-hidden=\"true\">↗</span></a>. در پایین بر اساس موضوع فیلتر کنید.", "Brevi spiegazioni visive su IA, machine learning e IA per l’ingegneria, condivise su <a class=\"link\" href=\"http://www.linkedin.com/in/hamid-ahmadi-asl-bb3005ab\" target=\"_blank\" rel=\"noopener noreferrer\">LinkedIn <span aria-hidden=\"true\">↗</span></a>. Filtra per argomento qui sotto.");
  add("ins.aria", "All posts", "همه‌ی نوشته‌ها", "Tutti i post");
  add("ins.filter", "Filter posts by topic", "فیلتر نوشته‌ها بر اساس موضوع", "Filtra i post per argomento");
  add("ins.noscript", "Enable JavaScript to see the posts, or visit the LinkedIn profile.", "برای دیدن نوشته‌ها جاوااسکریپت را فعال کنید، یا به پروفایل LinkedIn سر بزنید.", "Abilita JavaScript per vedere i post, oppure visita il profilo LinkedIn.");
  add("posts.viewLi", "View on LinkedIn", "مشاهده در LinkedIn", "Vedi su LinkedIn");
  add("posts.download", "Download", "دانلود", "Scarica");
  add("posts.soon", "New training posts are coming soon.", "نوشته‌های آموزشی تازه به‌زودی منتشر می‌شوند.", "Nuovi post formativi arriveranno a breve.");
  add("posts.fail", "Posts could not be loaded right now.", "در حال حاضر بارگذاری نوشته‌ها ممکن نشد.", "I post non possono essere caricati in questo momento.");
  add("posts.empty", "No posts in this topic yet.", "هنوز نوشته‌ای در این موضوع نیست.", "Non ci sono ancora post in questo argomento.");
  add("posts.all", "All", "همه", "Tutti");
  add("con.kicker", "Contact", "تماس", "Contatti");
  add("con.h1", "Let’s <span class=\"grad\">connect</span>", "در <span class=\"grad\">ارتباط</span> باشیم", "Restiamo in <span class=\"grad\">contatto</span>");
  add("con.sub", "Interested in research across science and engineering — feel free to get in touch.", "اگر به پژوهش در مرز علم و مهندسی علاقه‌مندید، خوشحال می‌شوم در تماس باشید.", "Se ti interessa la ricerca tra scienza e ingegneria, non esitare a scrivermi.");
  add("con.send", "Send an email", "ارسال ایمیل", "Invia un’email");
  add("e404.crumb", "404", "404", "404");
  add("e404.kicker", "Error 404", "خطای 404", "Errore 404");
  add("e404.h1", "Page not <span class=\"grad\">found</span>", "صفحه پیدا <span class=\"grad\">نشد</span>", "Pagina non <span class=\"grad\">trovata</span>");
  add("e404.sub", "This address isn’t on the site. Use the menu, or return home.", "این نشانی در سایت نیست. از منو استفاده کنید یا به خانه بازگردید.", "Questo indirizzo non è presente sul sito. Usa il menu oppure torna alla home.");
  add("e404.back", "Back to Home", "بازگشت به خانه", "Torna alla Home");
  add("res.kicker", "Research & Publications", "پژوهش و انتشارات", "Ricerca e pubblicazioni");
  add("res.h1", "Papers and <span class=\"grad\">book</span>", "مقالات و <span class=\"grad\">کتاب</span>", "Articoli e <span class=\"grad\">libro</span>");
  add("res.sub", "Journal articles and a book, also listed on <a class=\"link\" href=\"https://scholar.google.com/citations?user=Ccy6x7cAAAAJ&amp;hl=en\" target=\"_blank\" rel=\"noopener noreferrer\">Google Scholar <span aria-hidden=\"true\">↗</span></a>.", "مقالات علمی و یک کتاب، که در <a class=\"link\" href=\"https://scholar.google.com/citations?user=Ccy6x7cAAAAJ&amp;hl=en\" target=\"_blank\" rel=\"noopener noreferrer\">Google Scholar <span aria-hidden=\"true\">↗</span></a> نیز فهرست شده‌اند.", "Articoli su rivista e un libro, anche elencati su <a class=\"link\" href=\"https://scholar.google.com/citations?user=Ccy6x7cAAAAJ&amp;hl=en\" target=\"_blank\" rel=\"noopener noreferrer\">Google Scholar <span aria-hidden=\"true\">↗</span></a>.");
  add("res.papers", "Papers", "مقالات", "Articoli");
  add("res.book", "Book", "کتاب", "Libro");
  add("pubs.abstract", "Abstract", "چکیده", "Abstract");
  add("pubs.about", "About the book", "درباره‌ی کتاب", "Sul libro");
  add("pubs.journal", "Journal article", "مقاله در نشریه", "Articolo della rivista");
  add("pubs.view", "View document", "مشاهده‌ی فایل", "Vedi il documento");
  add("pubs.sd", "ScienceDirect", "ScienceDirect", "ScienceDirect");
  add("pubs.doi", "DOI", "DOI", "DOI");
  add("pubs.open", "Open →", "گشودن ←", "Apri →");
  add("pubs.close", "Close publication", "بستن اثر", "Chiudi la pubblicazione");
  add("pubs.openAria", "Open publication", "گشودن اثر", "Apri la pubblicazione");
  add("pubs.new", "New", "تازه", "Nuovo");

  add("hero.scroll", "Scroll to About", "رفتن به بخش درباره", "Vai a Informazioni");
  add("skills.flow.aria", "Physics, then Engineering, then AI, leading to Intelligent Engineering Systems", "فیزیک، سپس مهندسی، سپس هوش مصنوعی، که به سامانه‌های مهندسی هوشمند می‌انجامد", "Fisica, poi ingegneria, poi IA, fino ai sistemi ingegneristici intelligenti");
  add("posts.seeLi", "See my posts on LinkedIn", "نوشته‌های من را در LinkedIn ببینید", "Vedi i miei post su LinkedIn");
  add("pubs.journalPage", "Journal page", "صفحه مجله", "Pagina della rivista");
  add("skills.i.supervised", "Supervised Learning", "یادگیری نظارت‌شده", "Apprendimento supervisionato");
  add("skills.i.regression", "Regression", "رگرسیون", "Regressione");
  add("skills.i.classification", "Classification", "طبقه‌بندی", "Classificazione");
  add("skills.i.eval", "Model Evaluation", "ارزیابی مدل", "Valutazione dei modelli");
  add("skills.i.data", "Data Analysis", "تحلیل داده", "Analisi dei dati");
  add("skills.i.ml", "Machine Learning", "یادگیری ماشین", "Machine learning");
  add("skills.i.aieng", "AI for Engineering Applications", "هوش مصنوعی در کاربردهای مهندسی", "IA per applicazioni ingegneristiche");
  add("skills.i.parallel", "Parallel Computing", "رایانش موازی", "Calcolo parallelo");
  add("skills.i.numsim", "Numerical Simulation", "شبیه‌سازی عددی", "Simulazione numerica");
  add("skills.i.desopt", "Design Optimization", "بهینه‌سازی طراحی", "Ottimizzazione della progettazione");
  add("skills.i.mechdes", "Mechanical Design", "طراحی مکانیکی", "Progettazione meccanica");
  add("skills.i.stationary", "Stationary Equipment", "تجهیزات ثابت", "Apparecchiature stazionarie");
  add("skills.i.vdr", "Vendor Document Review (VDR)", "بررسی مدارک سازنده (VDR)", "Revisione dei documenti del fornitore (VDR)");
  add("skills.i.mr", "Material Requisition (MR)", "درخواست کالا (MR)", "Richiesta di materiali (MR)");
  add("skills.cw.nn", "Neural Networks", "شبکه‌های عصبی", "Reti neurali");
  add("skills.cw.iot", "Internet of Things (IoT)", "اینترنت اشیا (IoT)", "Internet delle cose (IoT)");
  add("skills.cw.signal", "Signal & Image Processing", "پردازش سیگنال و تصویر", "Elaborazione di segnali e immagini");
  add("skills.cw.cv", "Computer Vision for Industry", "بینایی ماشین در صنعت", "Visione artificiale per l’industria");
  add("skills.cw.consumer", "Intelligent Consumer Technologies", "فناوری‌های هوشمند مصرفی", "Tecnologie intelligenti per il consumatore");
  add("skills.cw.text", "Text Mining and Search", "متن‌کاوی و جستجو", "Text mining e ricerca");
  add("skills.ex.gen", "Generative AI & LLMs", "هوش مصنوعی مولد و مدل‌های زبانی بزرگ", "IA generativa e LLM");
  add("skills.ex.iot", "IoT & Intelligent Monitoring", "اینترنت اشیا و پایش هوشمند", "IoT e monitoraggio intelligente");
  add("skills.ex.bim", "BIM & Digital Twins", "مدل‌سازی اطلاعات ساختمان و دوقلوهای دیجیتال", "BIM e gemelli digitali");
  add("skills.ex.causal", "Causal AI & Decision Support", "هوش مصنوعی علّی و پشتیبانی تصمیم", "IA causale e supporto alle decisioni");

  add("name.full", "Hamid Ahmadi Asl", "حمید احمدی‌اصل", "Hamid Ahmadi Asl");
  add("name.hero", "Hamid <span class=\"grad\">Ahmadi Asl</span>", "حمید <span class=\"grad\">احمدی‌اصل</span>", "Hamid <span class=\"grad\">Ahmadi Asl</span>");

  var FI = {
    "title.home": "Hamid Ahmadi Asl · tutkija, tekoäly ja laskennallinen tiede",
    "title.education": "Koulutus · Hamid Ahmadi Asl",
    "title.research": "Tutkimus · Hamid Ahmadi Asl",
    "title.patents": "Patentit · Hamid Ahmadi Asl",
    "title.experience": "Kokemus · Hamid Ahmadi Asl",
    "title.skills": "Osaaminen · Hamid Ahmadi Asl",
    "title.insights": "Artikkelit · Hamid Ahmadi Asl",
    "title.honors": "Tunnustukset · Hamid Ahmadi Asl",
    "title.contact": "Yhteys · Hamid Ahmadi Asl",
    "title.404": "Sivua ei löytynyt · Hamid Ahmadi Asl",
    "nav.home": "Etusivu",
    "nav.education": "Koulutus",
    "nav.research": "Tutkimus",
    "nav.patents": "Patentit",
    "nav.experience": "Kokemus",
    "nav.skills": "Osaaminen",
    "nav.insights": "Artikkelit",
    "nav.honors": "Palkinnot",
    "nav.contact": "Yhteys",
    "nav.primary": "Päävalikko",
    "nav.toggle": "Avaa tai sulje valikko",
    "nav.brand": "Hamid Ahmadi Asl — etusivu",
    "lang.label": "Kieli",
    "skip": "Siirry sisältöön",
    "footer.top": "Takaisin ylös ↑",
    "footer.privacy": "Tämä sivusto tallentaa anonyymejä käyntitilastoja ja keskusteluviestejä vastausten parantamiseksi; IP-osoitteita ei tallenneta.",
    "hero.eyebrow": "Insinööritiede <span class=\"eyebrow__accent\">kohtaa</span> tekoälyn",
    "hero.title": "Tutkija tekoälyn ja laskennallisen tieteen parissa, taustana konetekniikka",
    "hero.lead": "Yhdistän insinööritietoa ja tekoälyä käytännön ratkaisuihin monimutkaisissa, todellisissa ongelmissa. Opiskelen maisteriksi Artificial Intelligence for Science and Technology -ohjelmassa Università degli Studi di Milano-Bicoccassa.",
    "hero.quote": "“Minua innostaa eniten tutkimus, jossa fysiikka, insinööritiede ja tekoäly kohtaavat.”",
    "cta.scholar": "Google Scholar",
    "cta.linkedin": "LinkedIn",
    "cta.github": "GitHub",
    "cta.email": "Sähköposti",
    "about.kicker": "01 — Esittely",
    "about.heading": "Lyhyt profiili",
    "about.p1": "Olen tekoälyn ja laskennallisen tieteen tutkija, taustaltani konetekniikan osaaja, ja suoritan parhaillaan maisterintutkintoa Artificial Intelligence for Science and Technology -ohjelmassa Università degli Studi di Milano-Bicoccassa. Kehitän koneoppimismalleja fysikaalisille ja teknisille järjestelmille: hyödynnän CFD- ja koetuloksia sijaismallien koulutukseen, virtauskenttien rekonstruointiin ja suunnitteluavaruuden tutkimiseen.",
    "about.p2": "Työskentelen siellä, missä fysiikka kohtaa datan: tieteellinen koneoppiminen, pienten otosten sijaismallien datan laatu ja yleistettävyys sekä dataan perustuva suunnittelun optimointi. Vuosien T&K- ja teollisuuskokemus projektin apulaisjohtajana (PSL) ja suunnitteluinsinöörinä sekä patentit ja vertaisarvioidut julkaisut pitävät mallini kiinni siinä, mitä todelliset insinööriongelmat vaativat.",
    "about.p3": "Minua motivoi tutkimus, jossa tekoäly nopeuttaa tieteellistä löytämistä ja insinöörisuunnittelua. Jaan säännöllisesti koulutusjulkaisuja, joissa avaan koneoppimisen ja syväoppimisen käsitteitä.",
    "stats.degrees": "Tutkinnot",
    "stats.papers": "Lehtiartikkelit",
    "stats.patents": "Patentit",
    "stats.book": "Julkaistu kirja",
    "stats.aria": "Lyhyesti",
    "journey.heading": "Polkuni",
    "journey.aria": "Konetekniikasta tieteelliseen koneoppimiseen",
    "journey.1": "Konetekniikka",
    "journey.2": "Virtausmekaniikka",
    "journey.3": "Numeerinen simulointi (CFD)",
    "journey.4": "Kokeellinen tutkimus",
    "journey.5": "Teollinen T&K",
    "journey.6": "Tekoäly",
    "journey.7": "Tieteellinen koneoppiminen",
    "journey.note": "Jokainen vaihe on laajentanut teknistä työkalupakkiani. Keskityn siihen, että insinööriongelmista tulee käytännöllisiä, dataan perustuvia ratkaisuja.",
    "explore.kicker": "Tutustu",
    "explore.heading": "Tarkemmin",
    "explore.sub": "Siirry osioon — jokaisella sivulla on sama valikko, teema ja avustaja.",
    "explore.go": "Tutustu →",
    "explore.education.p": "AI4ST-maisteriohjelma UNIMIB:ssä sekä aiemmat konetekniikan tutkinnot.",
    "explore.research.p": "Uusi artikkeli pienten otosten ML-sijaismalleista sekä lehtiartikkeleita ja kirja.",
    "explore.patents.p": "Kaksi iranilaista patenttia: tuulennopeuskanava ja puhallintuulitunneli.",
    "explore.experience.p": "Mekaanisesta suunnittelusta ja teollisuuden CFD:stä tekoälykoulutukseen ja tutkimukseen.",
    "explore.skills.p": "Python, koneoppiminen, CFD, suurteholaskenta ja insinöörisuunnittelu.",
    "explore.insights.p": "Lyhyitä visuaalisia oppaita tekoälystä, koneoppimisesta ja tekoälystä insinöörityössä.",
    "explore.honors.p": "Palkintoja patentoidusta kanavaturbiinista, vuoden parhaan artikkelin palkinto ja muuta.",
    "explore.contact.p": "Sähköposti, LinkedIn, Google Scholar ja GitHub — tai keskustele sivuston avustajan kanssa.",
    "badge.new": "Uusi",
    "edu.kicker": "Koulutus",
    "edu.h1": "Akateeminen <span class=\"grad\">tausta</span>",
    "edu.sub": "Konetekniikasta maisteriohjelmaan Artificial Intelligence for Science and Technology Università degli Studi di Milano-Bicoccassa.",
    "edu.now": "2025 – nyt",
    "edu.inprogress": "Käynnissä",
    "edu.msc.ai.title": "Master of Artificial Intelligence for Science and Technology",
    "edu.msc.ai.place": "Fysiikan laitos “Giuseppe Occhialini”, Università degli Studi di Milano-Bicocca, Milano, Italia.",
    "edu.msc.me.title": "Tekniikan maisteri, konetekniikka — energian muunto",
    "edu.msc.me.place": "Konetekniikan laitos, South Tehran Branch, IAU, Teheran, Iran.",
    "edu.highlights": "Tutkimuksen kohokohtia",
    "edu.hl1": "Rakensin täyden mittakaavan koelaitteistoja",
    "edu.hl2": "Validoin CFD-malleja kokeellisesti",
    "edu.hl3": "Yhdistin numeerisia ja kokeellisia menetelmiä",
    "edu.msc.me.note": "Tämä työ vahvisti taitoani yhdistää fysikaalinen ymmärrys, simulointi ja kokeellinen näyttö.",
    "edu.bsc.title": "Tekniikan kandidaatti, konetekniikka — lämpö ja virtaukset",
    "edu.bsc.place": "Konetekniikan laitos, South Tehran Branch, IAU, Teheran, Iran.",
    "exp.kicker": "Kokemus",
    "exp.h1": "Ammatillinen <span class=\"grad\">kokemus</span>",
    "exp.sub": "Tehtäviä tekoälykoulutuksessa, projektinjohtamisessa, suunnitteluinsinöörinä sekä mallinnuksessa ja simuloinnissa.",
    "exp.now": "2026 – nyt",
    "exp.r1.title": "AI Training Contributor",
    "exp.r1.desc": "Tekoälyn annotointi; insinöörityöhön keskittyvä tekoälykoulutus ja arviointi.",
    "exp.r2.title": "Project Sub-Leader (PSL)",
    "exp.r2.desc": "Koordinoin insinöörejä ja ratkaisin poikkitieteellisiä teknisiä kysymyksiä; jaoin tehtäviä, johdin kokouksia ja laadin edistymisraportteja.",
    "exp.r3.title": "Suunnitteluinsinööri",
    "exp.r3.desc": "Suunnittelin kiinteitä laitteita; laadin materiaalipyyntöjä (MR); tein toimittaja-asiakirjojen tarkistusta (VDR).",
    "exp.r4.title": "Mallinnus ja simulointi",
    "exp.r4.desc": "Toteutin numeerista simulointia ja mallinnusta T&K- ja teollisuusprojekteissa.",
    "exp.r5.title": "Simuloinnin ja optimoinnin asiantuntija",
    "exp.r5.desc": "Tein numeerista simulointia ja mallinnusta; kehitin suunnittelukonsepteja; koordinoin projektiryhmän jäseniä.",
    "exp.r6.title": "Mallinnus ja simulointi",
    "exp.r6.desc": "Toteutin projektikohtaista numeerista simulointia ja mallinnusta T&K-työhön.",
    "exp.r7.title": "Konetekniikan insinööri",
    "exp.r7.desc": "Tein mekaanisia laskelmia, numeerista simulointia ja suunnittelun arviointia; tein yhteistyötä T&K-kumppaneiden kanssa.",
    "exp.tag.rdind": "T&K ja teollisuus",
    "exp.tag.rd": "T&K",
    "exp.tag.industry": "Teollisuus",
    "skills.kicker": "Osaaminen",
    "skills.h1": "Tekninen <span class=\"grad\">osaaminen</span>",
    "skills.sub": "Työkaluja ja menetelmiä tieteellisestä laskennasta, koneoppimisesta, CFD:stä, suurteholaskennasta ja insinöörityöstä.",
    "skills.g.prog": "Ohjelmointi ja tieteellinen laskenta",
    "skills.g.ml": "Koneoppiminen ja syväoppiminen",
    "skills.g.data": "Data ja tekoäly",
    "skills.g.hpc": "Suurteholaskenta",
    "skills.g.comp": "Laskennallinen insinööritiede",
    "skills.g.eng": "Insinööritiede",
    "skills.core": "Keskeinen osaaminen",
    "skills.c1": "Mekaaninen ja insinöörisuunnittelu",
    "skills.c2": "Numeerinen simulointi ja CFD",
    "skills.c3": "Suunnittelun optimointi",
    "skills.c4": "Poikkitieteellinen yhteistyö",
    "skills.c5": "Projektin koordinointi ja ongelmanratkaisu",
    "skills.course": "Nykyiset tekoälyopinnot",
    "skills.explore": "Aiheita, joita tutkin",
    "skills.flow.phys": "Fysiikka",
    "skills.flow.eng": "Insinööritiede",
    "skills.flow.ai": "Tekoäly",
    "skills.flow.end": "Älykkäät insinöörijärjestelmät",
    "honors.kicker": "Tunnustukset ja palkinnot",
    "honors.h1": "Tunnustukset ja <span class=\"grad\">kielet</span>",
    "honors.sub": "Palkintoja tutkimuksesta ja keksinnöistä sekä kielitaito.",
    "honors.a1": "Patentoidun kanavoidun tuuliturbiinin kaupallistamisen akkreditointi ja pisteytys, jonka myönsi Iranin tieteellinen ja teollinen tutkimusorganisaatio; tiede-, tutkimus- ja teknologiaministeriö.",
    "honors.a2": "Vuoden parhaan artikkelin palkinto, South Tehran Branch, Azad University.",
    "honors.a3": "Kuudennen Khwarizmi-nuorisopalkinnon alueellinen valinta.",
    "honors.view": "Näytä asiakirja",
    "honors.langs": "Kielet",
    "honors.langprof": "Kielitaito",
    "honors.en": "Englanti",
    "honors.en.score": "Kokonaispistemäärä: 7.0 · koepäivä 24.10.2024",
    "honors.it": "Italia",
    "honors.it.level": "A1 · opiskelen parhaillaan A2-tasolla",
    "pat.kicker": "Patentit",
    "pat.h1": "Patentoitu <span class=\"grad\">Iranissa</span>",
    "pat.sub": "Kaksi myönnettyä patenttia tuulienergia- ja tuulitunnelilaitteistoihin.",
    "pat.no": "Patenttinro",
    "pat.iniran": "Patentoitu Iranissa",
    "pat.view": "Näytä asiakirja",
    "ins.kicker": "Koulutus ja artikkelit",
    "ins.h1": "Visuaaliset oppaat ja <span class=\"grad\">julkaisut</span>",
    "ins.sub": "Lyhyitä visuaalisia selityksiä tekoälystä, koneoppimisesta ja tekoälystä insinöörityössä, jaettu <a class=\"link\" href=\"http://www.linkedin.com/in/hamid-ahmadi-asl-bb3005ab\" target=\"_blank\" rel=\"noopener noreferrer\">LinkedInissä <span aria-hidden=\"true\">↗</span></a>. Suodata aiheen mukaan alla.",
    "ins.aria": "Kaikki julkaisut",
    "ins.filter": "Suodata julkaisuja aiheen mukaan",
    "ins.noscript": "Ota JavaScript käyttöön nähdäksesi julkaisut, tai käy LinkedIn-profiilissa.",
    "posts.viewLi": "Näytä LinkedInissä",
    "posts.download": "Lataa",
    "posts.soon": "Uusia koulutusjulkaisuja on tulossa pian.",
    "posts.fail": "Julkaisuja ei voitu ladata juuri nyt.",
    "posts.empty": "Tässä aiheessa ei ole vielä julkaisuja.",
    "posts.all": "Kaikki",
    "con.kicker": "Yhteys",
    "con.h1": "Otetaan <span class=\"grad\">yhteyttä</span>",
    "con.sub": "Olen kiinnostunut tutkimuksesta tieteen ja insinööritieteen rajapinnassa — voit ottaa yhteyttä vapaasti.",
    "con.send": "Lähetä sähköposti",
    "e404.crumb": "404",
    "e404.kicker": "Virhe 404",
    "e404.h1": "Sivua ei <span class=\"grad\">löytynyt</span>",
    "e404.sub": "Tätä osoitetta ei ole sivustolla. Käytä valikkoa tai palaa etusivulle.",
    "e404.back": "Takaisin etusivulle",
    "res.kicker": "Tutkimus ja julkaisut",
    "res.h1": "Artikkelit ja <span class=\"grad\">kirja</span>",
    "res.sub": "Lehtiartikkeleita ja kirja, jotka löytyvät myös <a class=\"link\" href=\"https://scholar.google.com/citations?user=Ccy6x7cAAAAJ&amp;hl=en\" target=\"_blank\" rel=\"noopener noreferrer\">Google Scholarista <span aria-hidden=\"true\">↗</span></a>.",
    "res.papers": "Artikkelit",
    "res.book": "Kirja",
    "pubs.abstract": "Tiivistelmä",
    "pubs.about": "Tietoa kirjasta",
    "pubs.journal": "Lehtiartikkeli",
    "pubs.view": "Näytä asiakirja",
    "pubs.sd": "ScienceDirect",
    "pubs.doi": "DOI",
    "pubs.open": "Avaa →",
    "pubs.close": "Sulje julkaisu",
    "pubs.openAria": "Avaa julkaisu",
    "pubs.new": "Uusi",
    "hero.scroll": "Siirry esittelyyn",
    "skills.flow.aria": "Fysiikka, sitten insinööritiede, sitten tekoäly, kohti älykkäitä insinöörijärjestelmiä",
    "posts.seeLi": "Katso julkaisuni LinkedInissä",
    "pubs.journalPage": "Lehden sivu",
    "skills.i.supervised": "Ohjattu oppiminen",
    "skills.i.regression": "Regressio",
    "skills.i.classification": "Luokittelu",
    "skills.i.eval": "Mallin arviointi",
    "skills.i.data": "Data-analyysi",
    "skills.i.ml": "Koneoppiminen",
    "skills.i.aieng": "Tekoäly insinöörisovelluksissa",
    "skills.i.parallel": "Rinnakkaislaskenta",
    "skills.i.numsim": "Numeerinen simulointi",
    "skills.i.desopt": "Suunnittelun optimointi",
    "skills.i.mechdes": "Mekaaninen suunnittelu",
    "skills.i.stationary": "Kiinteät laitteet",
    "skills.i.vdr": "Toimittaja-asiakirjojen tarkistus (VDR)",
    "skills.i.mr": "Materiaalipyyntö (MR)",
    "skills.cw.nn": "Neuroverkot",
    "skills.cw.iot": "Esineiden internet (IoT)",
    "skills.cw.signal": "Signaali- ja kuvankäsittely",
    "skills.cw.cv": "Konenäkö teollisuudessa",
    "skills.cw.consumer": "Älykkäät kuluttajateknologiat",
    "skills.cw.text": "Tekstin louhinta ja haku",
    "skills.ex.gen": "Generatiivinen tekoäly ja suuret kielimallit",
    "skills.ex.iot": "IoT ja älykäs seuranta",
    "skills.ex.bim": "BIM ja digitaaliset kaksoset",
    "skills.ex.causal": "Kausaalinen tekoäly ja päätöksenteon tuki",
    "name.full": "Hamid Ahmadi Asl",
    "name.hero": "Hamid <span class=\"grad\">Ahmadi Asl</span>"
  };
  Object.keys(FI).forEach(function (k) { DICT.fi[k] = FI[k]; });

  var api = {
    detect: detect,
    t: function (key) { return t(document.documentElement.getAttribute('data-lang') || detect(), key); },
    apply: apply,
    setLang: setLang
  };
  Object.defineProperty(api, 'lang', {
    get: function () { return document.documentElement.getAttribute('data-lang') || detect(); }
  });

  function start() {
    apply(detect());
    bind();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
  global.HA_I18N = api;
})(window);
