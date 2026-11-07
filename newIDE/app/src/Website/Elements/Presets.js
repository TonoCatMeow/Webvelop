// @flow
// Ready-made blocks inserted from the "Insert" panel. Each preset builds
// fresh elements (with new ids) and the interactions wiring them together.
import { createElement } from './ElementTypes';
import { type WebsiteElement, type InteractionEvent } from '../Model/Schema';
import { makeEvent, makeAction, makeCondition } from '../Interactions/EventFactory';
import { getDefaultBehaviorConfig } from '../Behaviors/BehaviorTypes';

export type PresetResult = {|
  elements: Array<WebsiteElement>,
  events: Array<InteractionEvent>,
|};

export type PresetDefinition = {|
  id: string,
  label: string,
  description: string,
  category: 'sections' | 'widgets',
  icon: string,
  build: () => PresetResult,
|};

/** An inline SVG placeholder image, so that templates work offline. */
export const placeholderImage = (
  label: string,
  fromColor: string = '#6366f1',
  toColor: string = '#06b6d4',
  width: number = 800,
  height: number = 500
): string => {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${fromColor}"/><stop offset="1" stop-color="${toColor}"/></linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>` +
    `<text x="50%" y="50%" fill="rgba(255,255,255,0.9)" font-family="Arial, sans-serif" font-size="${Math.round(
      height / 9
    )}" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};

const el = createElement;
const behavior = (type: string, config: { [string]: any } = {}) => ({
  type,
  config: { ...getDefaultBehaviorConfig(type), ...config },
});

export const buildNavbar = (
  siteName: string = 'Brand',
  links: Array<{| text: string, href: string |}> = [
    { text: 'Home', href: '#' },
    { text: 'Features', href: '#features' },
    { text: 'Contact', href: '#contact' },
  ]
): PresetResult => {
  const menuButton = el('button', {
    name: 'Menu button',
    props: { text: '', icon: 'menu', ariaLabel: 'Open the menu' },
    styles: {
      desktop: {
        display: 'none',
        padding: '8px',
        backgroundColor: 'transparent',
        color: 'var(--color-text)',
        alignSelf: 'center',
      },
      mobile: { display: 'inline-flex' },
    },
  });
  const navLinks = el('navigation', {
    name: 'Navigation links',
    styles: {
      mobile: {
        display: 'none',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
        gap: '12px',
        padding: '12px 0',
      },
    },
    children: links.map(link =>
      el('link', {
        name: link.text + ' link',
        props: { text: link.text, href: link.href },
        styles: {
          desktop: { color: 'var(--color-text)', fontWeight: '500' },
          hover: { color: 'var(--color-primary)', textDecoration: 'none' },
        },
      })
    ),
  });
  const header = el('header', {
    name: 'Navigation bar',
    styles: {
      desktop: {
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        position: 'sticky',
        top: '0',
        zIndex: '50',
      },
      mobile: { flexWrap: 'wrap', padding: '12px 20px' },
    },
    children: [
      el('link', {
        name: 'Logo',
        props: { text: siteName, href: '#' },
        styles: {
          desktop: { fontWeight: '800', fontSize: '22px', color: 'var(--color-text)' },
          hover: { textDecoration: 'none' },
        },
      }),
      menuButton,
      navLinks,
    ],
  });
  return {
    elements: [header],
    events: [
      makeEvent({
        name: 'Open/close the menu on mobile',
        trigger: 'click',
        target: menuButton.id,
        actions: [makeAction('toggleVisibility', { target: navLinks.id })],
      }),
    ],
  };
};

export const buildHero = (): PresetResult => ({
  elements: [
    el('section', {
      name: 'Hero section',
      styles: {
        desktop: {
          alignItems: 'center',
          textAlign: 'center',
          padding: '120px 32px',
          background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)',
          color: '#ffffff',
        },
        mobile: { padding: '72px 20px' },
      },
      children: [
        el('heading', {
          name: 'Hero title',
          props: { text: 'Build something people love', level: 'h1' },
          styles: {
            desktop: { fontSize: '56px', lineHeight: '1.1', maxWidth: '800px' },
            mobile: { fontSize: '36px' },
          },
          behaviors: [],
        }),
        el('text', {
          name: 'Hero description',
          props: {
            text:
              'A short description explaining what you offer, who it is for and why it matters.',
            entranceAnimation: 'fade-up',
          },
          styles: { desktop: { fontSize: '20px', maxWidth: '640px', opacity: '0.92' } },
        }),
        el('row', {
          name: 'Hero buttons',
          styles: { desktop: { justifyContent: 'center' }, mobile: { alignItems: 'center' } },
          children: [
            el('button', {
              name: 'Primary button',
              props: { text: 'Get started', href: '#contact' },
              styles: { desktop: { backgroundColor: '#ffffff', color: 'var(--color-primary)' } },
            }),
            el('button', {
              name: 'Secondary button',
              props: { text: 'Learn more', href: '#features' },
              styles: {
                desktop: {
                  backgroundColor: 'transparent',
                  border: '2px solid rgba(255,255,255,0.8)',
                  color: '#ffffff',
                },
              },
            }),
          ],
        }),
      ],
    }),
  ],
  events: [],
});

export const buildCard = (
  title: string = 'Card title',
  text: string = 'A short description of this card.',
  image: ?string = placeholderImage('Image')
): WebsiteElement =>
  el('container', {
    name: 'Card',
    styles: {
      desktop: {
        padding: '0',
        gap: '0',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)',
        overflow: 'hidden',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      },
      hover: { transform: 'translateY(-4px)', boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)' },
    },
    children: [
      ...(image
        ? [
            el('image', {
              name: 'Card image',
              props: { src: image, alt: title },
              styles: { desktop: { borderRadius: '0', aspectRatio: '16 / 10' } },
            }),
          ]
        : []),
      el('container', {
        name: 'Card content',
        styles: { desktop: { padding: '20px', gap: '8px' } },
        children: [
          el('heading', { name: 'Card title', props: { text: title, level: 'h3' } }),
          el('text', { name: 'Card text', props: { text }, styles: { desktop: { color: 'var(--color-muted)' } } }),
        ],
      }),
    ],
  });

export const buildFeatures = (): PresetResult => {
  const features = [
    ['zap', 'Fast', 'Lightweight pages that load in an instant on every device.'],
    ['shield', 'Reliable', 'Built on web standards: HTML, CSS and JavaScript.'],
    ['users', 'Made for people', 'Accessible, responsive and easy to use.'],
  ];
  return {
    elements: [
      el('section', {
        name: 'Features section',
        props: { htmlId: 'features' },
        styles: { desktop: { alignItems: 'center' } },
        children: [
          el('heading', {
            name: 'Features title',
            props: { text: 'Why choose us', level: 'h2' },
            styles: { desktop: { fontSize: '36px', textAlign: 'center' } },
          }),
          el('grid', {
            name: 'Features grid',
            styles: { desktop: { width: '100%', maxWidth: '1100px' } },
            children: features.map(([icon, title, text]) =>
              el('container', {
                name: title + ' feature',
                props: { entranceAnimation: 'fade-up' },
                styles: {
                  desktop: {
                    padding: '28px',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: '12px',
                    boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
                  },
                },
                children: [
                  el('icon', { name: title + ' icon', props: { icon } }),
                  el('heading', { name: title + ' title', props: { text: title, level: 'h3' } }),
                  el('text', {
                    name: title + ' text',
                    props: { text },
                    styles: { desktop: { color: 'var(--color-muted)' } },
                  }),
                ],
              })
            ),
          }),
        ],
      }),
    ],
    events: [],
  };
};

export const buildContactForm = (): PresetResult => {
  const field = (label: string, input: WebsiteElement) =>
    el('container', {
      name: label + ' field',
      styles: { desktop: { padding: '0', gap: '6px' } },
      children: [
        el('label', { name: label + ' label', props: { text: label, forName: input.props.fieldName } }),
        input,
      ],
    });
  const nameInput = el('input', {
    name: 'Name input',
    props: { fieldName: 'name', placeholder: 'Jane Doe', required: true, minLength: '2' },
  });
  const emailInput = el('input', {
    name: 'Email input',
    props: { inputType: 'email', fieldName: 'email', placeholder: 'jane@example.com', required: true },
  });
  const messageInput = el('textarea', {
    name: 'Message input',
    props: { fieldName: 'message', placeholder: 'How can we help?', required: true },
  });
  const successMessage = el('text', {
    name: 'Success message',
    props: { text: 'Thank you {{state.contactName}}! We will get back to you soon.', initiallyHidden: true },
    styles: {
      desktop: {
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: '#dcfce7',
        color: '#166534',
      },
    },
  });
  const form = el('form', {
    name: 'Contact form',
    children: [
      field('Name', nameInput),
      field('Email', emailInput),
      field('Message', messageInput),
      el('button', { name: 'Send button', props: { text: 'Send message', buttonType: 'submit', icon: 'send' } }),
      successMessage,
    ],
  });
  return {
    elements: [
      el('section', {
        name: 'Contact section',
        props: { htmlId: 'contact' },
        styles: { desktop: { alignItems: 'center' } },
        children: [
          el('heading', {
            name: 'Contact title',
            props: { text: 'Get in touch', level: 'h2' },
            styles: { desktop: { fontSize: '36px' } },
          }),
          form,
        ],
      }),
    ],
    events: [
      makeEvent({
        name: 'Validate and handle the contact form',
        trigger: 'submit',
        target: form.id,
        conditions: [makeCondition('formIsValid', { target: form.id })],
        actions: [
          makeAction('setVariableFromInput', { target: nameInput.id, variable: 'contactName' }),
          makeAction('show', { target: successMessage.id }),
          makeAction('resetForm', { target: form.id }),
        ],
        elseActions: [
          makeAction('hide', { target: successMessage.id }),
          makeAction('reportValidity', { target: form.id }),
        ],
      }),
    ],
  };
};

export const buildFooter = (siteName: string = 'Brand'): PresetResult => ({
  elements: [
    el('footer', {
      name: 'Footer',
      styles: {
        desktop: { backgroundColor: '#0f172a', color: '#cbd5e1' },
        mobile: { flexDirection: 'column', alignItems: 'flex-start' },
      },
      children: [
        el('text', {
          name: 'Copyright',
          props: { text: `© ${new Date().getFullYear()} ${siteName}. All rights reserved.` },
        }),
        el('navigation', {
          name: 'Footer links',
          children: ['Privacy', 'Terms', 'Contact'].map(text =>
            el('link', {
              name: text + ' link',
              props: { text, href: '#' },
              styles: { desktop: { color: '#cbd5e1' }, hover: { color: '#ffffff' } },
            })
          ),
        }),
      ],
    }),
  ],
  events: [],
});

const buildTabs = (): PresetResult => {
  const names = ['Overview', 'Details', 'Reviews'];
  return {
    elements: [
      el('container', {
        name: 'Tabs',
        behaviors: [behavior('tabs')],
        styles: { desktop: { padding: '0', gap: '0', width: '100%' } },
        children: [
          el('row', {
            name: 'Tab buttons',
            styles: {
              desktop: { gap: '4px', borderBottom: '2px solid rgba(0,0,0,0.08)', flexWrap: 'nowrap' },
              mobile: { flexDirection: 'row' },
            },
            children: names.map(name =>
              el('button', {
                name: name + ' tab',
                props: { text: name },
                styles: {
                  desktop: {
                    backgroundColor: 'transparent',
                    color: 'var(--color-muted)',
                    borderRadius: '0',
                    borderBottom: '2px solid transparent',
                    marginBottom: '-2px',
                    alignSelf: 'auto',
                  },
                  hover: { transform: 'none', color: 'var(--color-text)' },
                  current: {
                    color: 'var(--color-primary)',
                    borderBottom: '2px solid var(--color-primary)',
                  },
                },
              })
            ),
          }),
          el('container', {
            name: 'Tab panels',
            styles: { desktop: { padding: '20px 0' } },
            children: names.map(name =>
              el('container', {
                name: name + ' panel',
                styles: { desktop: { padding: '0' } },
                children: [
                  el('heading', { name: name + ' heading', props: { text: name, level: 'h3' } }),
                  el('text', { name: name + ' text', props: { text: `Content of the "${name}" tab.` } }),
                ],
              })
            ),
          }),
        ],
      }),
    ],
    events: [],
  };
};

const buildAccordion = (): PresetResult => {
  const items = [
    ['What is this website about?', 'Explain what you do in one or two sentences.'],
    ['How much does it cost?', 'Describe your pricing, or link to a pricing page.'],
    ['How can I contact you?', 'Use the contact form, or send us an email.'],
  ];
  return {
    elements: [
      el('container', {
        name: 'FAQ (accordion)',
        behaviors: [behavior('accordion')],
        styles: { desktop: { padding: '0', gap: '8px', width: '100%', maxWidth: '760px' } },
        children: items.map(([question, answer]) =>
          el('container', {
            name: 'FAQ item',
            styles: {
              desktop: {
                padding: '0',
                gap: '0',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '10px',
                overflow: 'hidden',
              },
            },
            children: [
              el('button', {
                name: 'Question',
                props: { text: question, icon: 'chevron-down' },
                styles: {
                  desktop: {
                    width: '100%',
                    justifyContent: 'space-between',
                    flexDirection: 'row-reverse',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    borderRadius: '0',
                    textAlign: 'left',
                  },
                  hover: { transform: 'none' },
                  current: { color: 'var(--color-primary)' },
                },
              }),
              el('text', {
                name: 'Answer',
                props: { text: answer },
                styles: { desktop: { padding: '0 24px 16px 24px', color: 'var(--color-muted)' } },
              }),
            ],
          })
        ),
      }),
    ],
    events: [],
  };
};

const buildCarousel = (): PresetResult => ({
  elements: [
    el('container', {
      name: 'Carousel',
      behaviors: [behavior('carousel')],
      styles: {
        desktop: { padding: '0', width: '100%', borderRadius: '12px', overflow: 'hidden' },
      },
      children: [
        ['Slide 1', '#6366f1', '#a855f7'],
        ['Slide 2', '#0ea5e9', '#22c55e'],
        ['Slide 3', '#f97316', '#ef4444'],
      ].map(([label, from, to]) =>
        el('image', {
          name: label,
          props: { src: placeholderImage(label, from, to, 1200, 500), alt: label },
          styles: { desktop: { borderRadius: '0', aspectRatio: '12 / 5' } },
        })
      ),
    }),
  ],
  events: [],
});

const buildModal = (): PresetResult => {
  const closeButton = el('button', {
    name: 'Close button',
    props: { text: 'Close' },
    styles: { desktop: { alignSelf: 'flex-end' } },
  });
  const modal = el('container', {
    name: 'Popup',
    props: { initiallyHidden: true },
    behaviors: [behavior('modal')],
    styles: {
      desktop: {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        zIndex: '1000',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      },
    },
    children: [
      el('container', {
        name: 'Popup box',
        styles: {
          desktop: {
            backgroundColor: 'var(--color-surface)',
            borderRadius: '14px',
            padding: '28px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          },
        },
        children: [
          el('heading', { name: 'Popup title', props: { text: 'Hello there!', level: 'h3' } }),
          el('text', { name: 'Popup text', props: { text: 'This is a popup. Close it with the button, the Escape key or by clicking outside.' } }),
          closeButton,
        ],
      }),
    ],
  });
  const openButton = el('button', { name: 'Open popup button', props: { text: 'Open the popup' } });
  return {
    elements: [openButton, modal],
    events: [
      makeEvent({
        name: 'Open the popup',
        trigger: 'click',
        target: openButton.id,
        actions: [makeAction('openModal', { target: modal.id })],
      }),
      makeEvent({
        name: 'Close the popup',
        trigger: 'click',
        target: closeButton.id,
        actions: [makeAction('closeModal', { target: modal.id })],
      }),
    ],
  };
};

const buildDropdown = (): PresetResult => ({
  elements: [
    el('container', {
      name: 'Dropdown',
      behaviors: [behavior('dropdown')],
      styles: { desktop: { padding: '0', position: 'relative', alignSelf: 'flex-start' } },
      children: [
        el('button', { name: 'Dropdown button', props: { text: 'Menu', icon: 'chevron-down' }, styles: { desktop: { flexDirection: 'row-reverse' } } }),
        el('container', {
          name: 'Dropdown menu',
          styles: {
            desktop: {
              position: 'absolute',
              top: '100%',
              left: '0',
              marginTop: '6px',
              minWidth: '200px',
              padding: '8px',
              gap: '4px',
              backgroundColor: 'var(--color-surface)',
              borderRadius: '10px',
              boxShadow: '0 12px 32px rgba(15,23,42,0.18)',
              zIndex: '20',
            },
          },
          children: ['Profile', 'Settings', 'Sign out'].map(text =>
            el('link', {
              name: text + ' item',
              props: { text, href: '#' },
              styles: {
                desktop: { padding: '8px 10px', borderRadius: '6px', color: 'var(--color-text)' },
                hover: { backgroundColor: 'rgba(99,102,241,0.1)', textDecoration: 'none' },
              },
            })
          ),
        }),
      ],
    }),
  ],
  events: [],
});

const buildGallery = (): PresetResult => ({
  elements: [
    el('grid', {
      name: 'Image gallery',
      behaviors: [behavior('lightbox')],
      styles: { desktop: { width: '100%' } },
      children: [
        ['Photo 1', '#f43f5e', '#f97316'],
        ['Photo 2', '#8b5cf6', '#3b82f6'],
        ['Photo 3', '#10b981', '#06b6d4'],
        ['Photo 4', '#eab308', '#f97316'],
        ['Photo 5', '#3b82f6', '#6366f1'],
        ['Photo 6', '#ec4899', '#8b5cf6'],
      ].map(([label, from, to]) =>
        el('image', {
          name: label,
          props: { src: placeholderImage(label, from, to, 800, 600), alt: label },
          styles: {
            desktop: { aspectRatio: '4 / 3', cursor: 'zoom-in', transition: 'transform 0.2s ease' },
            hover: { transform: 'scale(1.02)' },
          },
        })
      ),
    }),
  ],
  events: [],
});

const buildCardPreset = (): PresetResult => ({
  elements: [buildCard()],
  events: [],
});

const buildBackToTop = (): PresetResult => {
  const button = el('button', {
    name: 'Back to top',
    props: { text: '', icon: 'arrow-up', ariaLabel: 'Back to top', initiallyHidden: true },
    styles: {
      desktop: {
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        width: '48px',
        height: '48px',
        padding: '0',
        borderRadius: '999px',
        zIndex: '40',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      },
    },
  });
  return {
    elements: [button],
    events: [
      makeEvent({
        name: 'Show the button after scrolling',
        trigger: 'scroll',
        triggerParams: { distance: 400, direction: 'down' },
        actions: [makeAction('show', { target: button.id })],
      }),
      makeEvent({
        name: 'Hide the button at the top',
        trigger: 'scroll',
        triggerParams: { distance: 400, direction: 'up' },
        actions: [makeAction('hide', { target: button.id })],
      }),
      makeEvent({
        name: 'Scroll to the top',
        trigger: 'click',
        target: button.id,
        actions: [makeAction('scrollToTop', { smooth: true })],
      }),
    ],
  };
};

export const PRESETS: Array<PresetDefinition> = [
  { id: 'navbar', label: 'Navigation bar', description: 'Logo, links and a mobile menu button.', category: 'sections', icon: 'header', build: () => buildNavbar() },
  { id: 'hero', label: 'Hero', description: 'A big title, a description and buttons.', category: 'sections', icon: 'section', build: buildHero },
  { id: 'features', label: 'Features', description: 'Three features with icons.', category: 'sections', icon: 'grid', build: buildFeatures },
  { id: 'contact', label: 'Contact form', description: 'A validated form showing a success message.', category: 'sections', icon: 'form', build: buildContactForm },
  { id: 'footer', label: 'Footer', description: 'Copyright and links.', category: 'sections', icon: 'footer', build: () => buildFooter() },
  { id: 'card', label: 'Card', description: 'An image, a title and a text.', category: 'widgets', icon: 'container', build: buildCardPreset },
  { id: 'tabs', label: 'Tabs', description: 'Panels switched with tabs.', category: 'widgets', icon: 'tabs', build: buildTabs },
  { id: 'accordion', label: 'Accordion (FAQ)', description: 'Questions that expand on click.', category: 'widgets', icon: 'list', build: buildAccordion },
  { id: 'carousel', label: 'Carousel', description: 'Slides with arrows, dots and autoplay.', category: 'widgets', icon: 'carousel', build: buildCarousel },
  { id: 'modal', label: 'Popup', description: 'A button opening a popup.', category: 'widgets', icon: 'modal', build: buildModal },
  { id: 'dropdown', label: 'Dropdown menu', description: 'A button opening a menu.', category: 'widgets', icon: 'select', build: buildDropdown },
  { id: 'gallery', label: 'Image gallery', description: 'A grid of images opening in full screen.', category: 'widgets', icon: 'image', build: buildGallery },
  { id: 'backToTop', label: 'Back to top button', description: 'Appears when scrolling down.', category: 'widgets', icon: 'button', build: buildBackToTop },
];
