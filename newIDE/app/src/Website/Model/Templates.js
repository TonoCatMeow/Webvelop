// @flow
// Creation of new website projects, from a template.
import {
  WEBVELOP_FORMAT_VERSION,
  type WebsiteProject,
  type WebsiteElement,
  type InteractionEvent,
} from './Schema';
import { newId, newUuid } from './Ids';
import { addPage, addComponent, addReactComponent, addScript } from './ProjectOps';
import { createElement } from '../Elements/ElementTypes';
import {
  buildNavbar,
  buildHero,
  buildFeatures,
  buildContactForm,
  buildFooter,
  buildCard,
  placeholderImage,
} from '../Elements/Presets';
import { makeEvent, makeAction } from '../Interactions/EventFactory';
import { getDefaultBehaviorConfig } from '../Behaviors/BehaviorTypes';
import { getIDEVersion } from '../../Version';

export type WebsiteTemplate = {|
  id: string,
  name: string,
  description: string,
  pages: Array<string>,
  colors: [string, string],
|};

export const WEBSITE_TEMPLATES: Array<WebsiteTemplate> = [
  {
    id: 'blank',
    name: 'Blank website',
    description: 'A single empty page, to start from scratch.',
    pages: ['Home'],
    colors: ['#e2e8f0', '#f8fafc'],
  },
  {
    id: 'landing',
    name: 'Landing page',
    description:
      'Navigation bar, hero, features, an interactive React counter, a validated contact form and a footer.',
    pages: ['Home'],
    colors: ['#4f46e5', '#06b6d4'],
  },
  {
    id: 'business',
    name: 'Business website',
    description:
      'Several pages sharing a header and a footer component: Home, Services, About and Contact.',
    pages: ['Home', 'Services', 'About', 'Contact'],
    colors: ['#0f766e', '#22c55e'],
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Show your work with a gallery opening in full screen, tabs and a popup.',
    pages: ['Home', 'Projects'],
    colors: ['#db2777', '#f97316'],
  },
];

export const createDefaultTheme = (primary: string = '#4f46e5', accent: string = '#06b6d4') => ({
  colors: [
    { name: 'primary', value: primary },
    { name: 'accent', value: accent },
    { name: 'text', value: '#0f172a' },
    { name: 'muted', value: '#64748b' },
    { name: 'background', value: '#f8fafc' },
    { name: 'surface', value: '#ffffff' },
  ],
  fonts: [
    {
      name: 'body',
      family: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      googleFont: false,
    },
    {
      name: 'heading',
      family: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      googleFont: false,
    },
  ],
  baseFontSize: '16px',
});

export const createEmptyWebsiteProject = (name: string): WebsiteProject => ({
  webvelop: { formatVersion: WEBVELOP_FORMAT_VERSION, createdWith: getIDEVersion() },
  uuid: newUuid(),
  name,
  author: '',
  version: '1.0.0',
  settings: {
    title: name,
    description: '',
    language: 'en',
    faviconAssetId: null,
    headHtml: '',
    globalCss: '',
    homePageId: '',
  },
  theme: createDefaultTheme(),
  pages: [],
  components: [],
  reactComponents: [],
  scripts: [],
  styleClasses: [],
  variables: [],
  customActions: [],
  globalEvents: [],
  assets: [],
});

const el = createElement;

const pageTitleSection = (title: string, subtitle: string): WebsiteElement =>
  el('section', {
    name: 'Page title',
    styles: {
      desktop: {
        alignItems: 'center',
        textAlign: 'center',
        padding: '80px 32px',
        background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
        color: '#ffffff',
      },
    },
    children: [
      el('heading', {
        name: 'Title',
        props: { text: title, level: 'h1' },
        styles: { desktop: { fontSize: '48px' }, mobile: { fontSize: '34px' } },
      }),
      el('text', { name: 'Subtitle', props: { text: subtitle }, styles: { desktop: { fontSize: '19px', opacity: '0.9' } } }),
    ],
  });

const addPageWithContent = (
  project: WebsiteProject,
  name: string,
  elements: Array<WebsiteElement>,
  events: Array<InteractionEvent> = []
) => {
  const { project: newProject, page } = addPage(project, name, elements);
  return {
    ...newProject,
    pages: newProject.pages.map(p => (p.id === page.id ? { ...p, events } : p)),
  };
};

const buildLanding = (project: WebsiteProject): WebsiteProject => {
  const { project: withReact, reactComponent } = addReactComponent(project, 'Like counter');
  let newProject = {
    ...withReact,
    variables: [
      { id: newId('w'), name: 'contactName', type: 'string', initialValue: '', persist: false },
      { id: newId('w'), name: 'likes', type: 'number', initialValue: '0', persist: true },
    ],
    reactComponents: withReact.reactComponents.map(component =>
      component.id === reactComponent.id
        ? {
            ...component,
            name: 'LikeCounter',
            description: 'A React component synchronized with the "likes" website variable.',
            props: [{ name: 'label', label: 'Label', type: 'text', defaultValue: 'Likes' }],
            code: `// This React component uses the "likes" variable of the website state:
// when the variable changes (here, or from an interaction), the component
// and the texts showing {{state.likes}} are updated.
function LikeCounter({ label }) {
  const [likes, setLikes] = Webvelop.useVariable('likes');
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (!bump) return;
    const timeout = setTimeout(() => setBump(false), 300);
    return () => clearTimeout(timeout);
  }, [bump]);

  return (
    <button
      className={'like-counter' + (bump ? ' like-counter--bump' : '')}
      onClick={() => {
        setLikes(Number(likes) + 1);
        setBump(true);
      }}
    >
      ♥ {label}: {likes}
    </button>
  );
}
`,
            css: `.like-counter {
  padding: 12px 22px;
  border-radius: 999px;
  border: 2px solid var(--color-primary);
  background: var(--color-surface);
  color: var(--color-primary);
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.like-counter--bump {
  transform: scale(1.12);
}
`,
          }
        : component
    ),
  };

  const navbar = buildNavbar(project.name);
  const hero = buildHero();
  const features = buildFeatures();
  const contact = buildContactForm();
  const footer = buildFooter(project.name);
  const reactSection = el('section', {
    name: 'React section',
    styles: { desktop: { alignItems: 'center', textAlign: 'center' } },
    children: [
      el('heading', { name: 'React title', props: { text: 'Interactive React components', level: 'h2' } }),
      el('text', {
        name: 'React text',
        props: {
          text: 'This button is a React component. It shares the "likes" variable with this text: {{state.likes}} likes so far.',
        },
        styles: { desktop: { color: 'var(--color-muted)', maxWidth: '600px' } },
      }),
      el('react', {
        name: 'Like counter',
        props: { reactComponentId: reactComponent.id, values: { label: 'Likes' } },
      }),
    ],
  });
  newProject = addPageWithContent(
    newProject,
    'Home',
    [
      ...navbar.elements,
      ...hero.elements,
      ...features.elements,
      reactSection,
      ...contact.elements,
      ...footer.elements,
    ],
    [...navbar.events, ...hero.events, ...features.events, ...contact.events]
  );
  return newProject;
};

const buildBusiness = (project: WebsiteProject): WebsiteProject => {
  // Header and footer are reusable components shared by all pages.
  const navbar = buildNavbar(project.name, [
    { text: 'Home', href: 'page:home' },
    { text: 'Services', href: 'page:services' },
    { text: 'About', href: 'page:about' },
    { text: 'Contact', href: 'page:contact' },
  ]);
  const { project: p1, component: header } = addComponent(project, 'Site header', navbar.elements[0]);
  let newProject = {
    ...p1,
    components: p1.components.map(c => (c.id === header.id ? { ...c, events: navbar.events } : c)),
  };
  const footer = buildFooter(project.name);
  const { project: p2, component: footerComponent } = addComponent(newProject, 'Site footer', footer.elements[0]);
  newProject = p2;

  const headerInstance = () => el('component', { name: 'Site header', props: { componentId: header.id, values: {} } });
  const footerInstance = () => el('component', { name: 'Site footer', props: { componentId: footerComponent.id, values: {} } });

  // A "Service card" component with props, reused several times.
  const serviceCard = el('container', {
    name: 'Service card',
    styles: {
      desktop: {
        padding: '28px',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '14px',
        boxShadow: '0 4px 18px rgba(15,23,42,0.07)',
        transition: 'transform 0.2s ease',
      },
      hover: { transform: 'translateY(-4px)' },
    },
    children: [
      el('icon', { name: 'Service icon', props: { icon: '{{props.icon}}' } }),
      el('heading', { name: 'Service title', props: { text: '{{props.title}}', level: 'h3' } }),
      el('text', { name: 'Service text', props: { text: '{{props.text}}' }, styles: { desktop: { color: 'var(--color-muted)' } } }),
    ],
  });
  const { project: p3, component: serviceComponent } = addComponent(newProject, 'Service card', serviceCard);
  newProject = {
    ...p3,
    components: p3.components.map(c =>
      c.id === serviceComponent.id
        ? {
            ...c,
            description: 'A card presenting a service. Its title, text and icon are props.',
            props: [
              { name: 'title', label: 'Title', type: 'text', defaultValue: 'Service' },
              { name: 'text', label: 'Text', type: 'longText', defaultValue: 'Describe this service.' },
              { name: 'icon', label: 'Icon name', type: 'text', defaultValue: 'star' },
            ],
          }
        : c
    ),
  };
  const serviceInstance = (title: string, text: string, icon: string) =>
    el('component', {
      name: title,
      props: { componentId: serviceComponent.id, values: { title, text, icon } },
    });
  const servicesGrid = () =>
    el('grid', {
      name: 'Services grid',
      styles: { desktop: { width: '100%', maxWidth: '1100px', alignSelf: 'center' } },
      children: [
        serviceInstance('Consulting', 'We help you define the right strategy.', 'message-circle'),
        serviceInstance('Design', 'Beautiful interfaces your customers will love.', 'layers'),
        serviceInstance('Development', 'Fast, accessible and reliable websites.', 'code'),
      ],
    });

  const hero = buildHero();
  newProject = addPageWithContent(newProject, 'Home', [
    headerInstance(),
    ...hero.elements,
    el('section', {
      name: 'Services preview',
      children: [
        el('heading', { name: 'Services title', props: { text: 'What we do', level: 'h2' }, styles: { desktop: { textAlign: 'center' } } }),
        servicesGrid(),
      ],
    }),
    footerInstance(),
  ]);
  newProject = addPageWithContent(newProject, 'Services', [
    headerInstance(),
    pageTitleSection('Our services', 'Everything you need to grow your business online.'),
    el('section', { name: 'Services', children: [servicesGrid()] }),
    footerInstance(),
  ]);
  newProject = addPageWithContent(newProject, 'About', [
    headerInstance(),
    pageTitleSection('About us', 'A small team with big ambitions.'),
    el('section', {
      name: 'Story',
      children: [
        el('row', {
          name: 'Story row',
          styles: { desktop: { alignItems: 'flex-start', flexWrap: 'nowrap' } },
          children: [
            el('image', {
              name: 'Team photo',
              props: { src: placeholderImage('Our team', '#0f766e', '#22c55e'), alt: 'Our team' },
              styles: { desktop: { width: '45%' }, mobile: { width: '100%' } },
            }),
            el('container', {
              name: 'Story text',
              styles: { desktop: { flex: '1', padding: '0' } },
              children: [
                el('heading', { name: 'Story title', props: { text: 'Our story', level: 'h2' } }),
                el('text', { name: 'Story paragraph', props: { text: 'Tell visitors how your company started, what you believe in and what makes you different.' } }),
              ],
            }),
          ],
        }),
      ],
    }),
    footerInstance(),
  ]);
  const contact = buildContactForm();
  newProject = addPageWithContent(
    newProject,
    'Contact',
    [headerInstance(), pageTitleSection('Contact', 'We usually answer within a day.'), ...contact.elements, footerInstance()],
    contact.events
  );
  newProject = {
    ...newProject,
    variables: [{ id: newId('w'), name: 'contactName', type: 'string', initialValue: '', persist: false }],
  };
  return newProject;
};

const buildPortfolio = (project: WebsiteProject): WebsiteProject => {
  const navbar = buildNavbar(project.name, [
    { text: 'Home', href: 'page:home' },
    { text: 'Projects', href: 'page:projects' },
  ]);
  const footer = buildFooter(project.name);
  const aboutButton = el('button', { name: 'About me button', props: { text: 'About me' } });
  const aboutPopup = el('container', {
    name: 'About popup',
    props: { initiallyHidden: true },
    behaviors: [{ type: 'modal', config: getDefaultBehaviorConfig('modal') }],
    styles: {
      desktop: {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        zIndex: '1000',
        backgroundColor: 'rgba(15,23,42,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
      },
    },
    children: [
      el('container', {
        name: 'About box',
        styles: {
          desktop: { backgroundColor: 'var(--color-surface)', borderRadius: '14px', padding: '28px', maxWidth: '460px' },
        },
        children: [
          el('heading', { name: 'About title', props: { text: 'Hi, I am a designer', level: 'h3' } }),
          el('text', { name: 'About text', props: { text: 'I create visual identities, illustrations and websites.' } }),
        ],
      }),
    ],
  });
  const intro = el('section', {
    name: 'Introduction',
    styles: { desktop: { alignItems: 'center', textAlign: 'center', padding: '96px 32px' } },
    children: [
      el('heading', {
        name: 'Name',
        props: { text: 'Creative portfolio', level: 'h1' },
        styles: { desktop: { fontSize: '56px', color: 'var(--color-primary)' }, mobile: { fontSize: '36px' } },
      }),
      el('text', { name: 'Tagline', props: { text: 'Design, illustration and web development.' }, styles: { desktop: { fontSize: '20px', color: 'var(--color-muted)' } } }),
      aboutButton,
      aboutPopup,
    ],
  });
  const tabs = el('container', {
    name: 'Skills tabs',
    behaviors: [{ type: 'tabs', config: getDefaultBehaviorConfig('tabs') }],
    styles: { desktop: { padding: '0', width: '100%', maxWidth: '800px', alignSelf: 'center' } },
    children: [
      el('row', {
        name: 'Tab buttons',
        styles: { mobile: { flexDirection: 'row' } },
        children: ['Design', 'Illustration', 'Code'].map(name =>
          el('button', {
            name: name + ' tab',
            props: { text: name },
            styles: {
              desktop: { backgroundColor: 'transparent', color: 'var(--color-text)', border: '1px solid rgba(0,0,0,0.15)' },
              current: { backgroundColor: 'var(--color-primary)', color: '#ffffff', border: '1px solid transparent' },
            },
          })
        ),
      }),
      el('container', {
        name: 'Tab panels',
        styles: { desktop: { padding: '16px 0' } },
        children: [
          ['Design', 'Brand identities, user interfaces and posters.'],
          ['Illustration', 'Editorial illustrations and characters.'],
          ['Code', 'Responsive websites built with HTML, CSS, JavaScript and React.'],
        ].map(([title, text]) =>
          el('text', { name: title + ' panel', props: { text } })
        ),
      }),
    ],
  });
  const featured = el('section', {
    name: 'Featured work',
    children: [
      el('heading', { name: 'Featured title', props: { text: 'Featured work', level: 'h2' } }),
      el('grid', {
        name: 'Featured grid',
        children: [
          buildCard('Brand identity', 'Logo and visual identity for a coffee shop.', placeholderImage('Brand', '#db2777', '#f97316')),
          buildCard('Mobile app', 'Interface design for a fitness application.', placeholderImage('App', '#7c3aed', '#db2777')),
          buildCard('Illustrations', 'A series of illustrations for a magazine.', placeholderImage('Art', '#f97316', '#eab308')),
        ],
      }),
      tabs,
    ],
  });
  let newProject = addPageWithContent(
    project,
    'Home',
    [...navbar.elements, intro, featured, ...footer.elements],
    [
      ...navbar.events,
      makeEvent({
        name: 'Open the about popup',
        trigger: 'click',
        target: aboutButton.id,
        actions: [makeAction('openModal', { target: aboutPopup.id })],
      }),
    ]
  );
  const navbar2 = buildNavbar(project.name, [
    { text: 'Home', href: 'page:home' },
    { text: 'Projects', href: 'page:projects' },
  ]);
  const footer2 = buildFooter(project.name);
  const gallery = el('grid', {
    name: 'Gallery',
    behaviors: [{ type: 'lightbox', config: {} }],
    children: [
      ['Project 1', '#db2777', '#f97316'],
      ['Project 2', '#7c3aed', '#2563eb'],
      ['Project 3', '#059669', '#0ea5e9'],
      ['Project 4', '#f59e0b', '#ef4444'],
      ['Project 5', '#0ea5e9', '#6366f1'],
      ['Project 6', '#ec4899', '#a855f7'],
    ].map(([label, from, to]) =>
      el('image', {
        name: label,
        props: { src: placeholderImage(label, from, to, 800, 600), alt: label },
        styles: { desktop: { aspectRatio: '4 / 3', cursor: 'zoom-in' } },
      })
    ),
  });
  newProject = addPageWithContent(
    newProject,
    'Projects',
    [
      ...navbar2.elements,
      pageTitleSection('Projects', 'Click on a project to see it in full screen.'),
      el('section', { name: 'Gallery section', children: [gallery] }),
      ...footer2.elements,
    ],
    navbar2.events
  );
  return newProject;
};

export const createWebsiteProject = ({
  name,
  templateId,
}: {|
  name: string,
  templateId: string,
|}): WebsiteProject => {
  const template = WEBSITE_TEMPLATES.find(t => t.id === templateId) || WEBSITE_TEMPLATES[0];
  let project = createEmptyWebsiteProject(name);
  project = { ...project, theme: createDefaultTheme(template.colors[0], template.colors[1]) };

  if (template.id === 'landing') project = buildLanding(project);
  else if (template.id === 'business') project = buildBusiness(project);
  else if (template.id === 'portfolio') project = buildPortfolio(project);
  else {
    project = {
      ...project,
      theme: createDefaultTheme(),
    };
    project = addPageWithContent(project, 'Home', [
      el('section', {
        name: 'First section',
        styles: { desktop: { minHeight: '320px', alignItems: 'center', justifyContent: 'center', textAlign: 'center' } },
        children: [
          el('heading', { name: 'Title', props: { text: 'Welcome to ' + name, level: 'h1' } }),
          el('text', {
            name: 'Introduction',
            props: { text: 'Add elements from the Insert panel, then style them with the Style panel.' },
            styles: { desktop: { color: 'var(--color-muted)' } },
          }),
        ],
      }),
    ]);
  }

  if (template.id !== 'blank') {
    const { project: withScript } = addScript(project, 'main');
    project = {
      ...withScript,
      scripts: withScript.scripts.map(script => ({
        ...script,
        code: `// This script runs on every page, once it is ready.
console.log('Welcome to ' + Webvelop.site.name + ' (page: ' + Webvelop.page.name + ')');
`,
      })),
    };
  }
  return project;
};
