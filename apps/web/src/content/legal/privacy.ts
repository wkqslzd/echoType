export type PrivacyBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'labeled'; label: string; text: string };

export type PrivacySection = {
  heading: string;
  blocks: PrivacyBlock[];
};

export type PrivacyPolicy = {
  title: string;
  lastUpdated: string;
  intro: string[];
  sections: PrivacySection[];
  contactEmail: string;
};

export const PRIVACY_POLICY: PrivacyPolicy = {
  title: 'Privacy Policy',
  lastUpdated: 'July 2026',
  intro: [
    'EchoType ("we", "us") is a personal portfolio project. This policy explains what data we collect and how we use it.',
  ],
  sections: [
    {
      heading: 'What we collect',
      blocks: [
        {
          type: 'labeled',
          label: 'Account data:',
          text: 'When you register, we collect your email address and display name. This data is stored in AWS (Amazon Web Services) and managed through AWS Cognito.',
        },
        {
          type: 'labeled',
          label: 'Google sign-in:',
          text: 'If you choose to sign in with Google, we receive your Google account email address and display name from Google OAuth. We use this information to create or link your EchoType account. We do not receive your Google password or any other Google account data.',
        },
        {
          type: 'labeled',
          label: 'Practice data:',
          text: 'When you are signed in, your courses, annotations, collections, and typing session statistics are stored in a PostgreSQL database hosted on AWS. Guest browsing stores courses locally in your browser only; that data is not sent to our servers until you sign in.',
        },
        {
          type: 'labeled',
          label: 'Error reports:',
          text: 'We use Sentry to capture application errors. Error reports may include your browser type, operating system, and anonymized usage context. For authenticated API errors, an internal user id may be attached to help diagnose issues. We do not include email addresses, passwords, or other directly identifying information in error reports.',
        },
      ],
    },
    {
      heading: "What we don't collect",
      blocks: [
        {
          type: 'paragraph',
          text: 'We do not collect payment information, location data, or sell your data to third parties. We do not use advertising or tracking cookies.',
        },
      ],
    },
    {
      heading: 'How we use your data',
      blocks: [
        { type: 'paragraph', text: 'To provide the EchoType typing practice service' },
        { type: 'paragraph', text: 'To save your courses and practice history across sessions' },
        { type: 'paragraph', text: 'To identify and fix application errors' },
      ],
    },
    {
      heading: 'Data storage',
      blocks: [
        {
          type: 'paragraph',
          text: 'All data is stored on AWS infrastructure in the ap-southeast-2 (Sydney) region.',
        },
      ],
    },
    {
      heading: 'Account deletion',
      blocks: [
        {
          type: 'paragraph',
          text: 'You can delete your account and all associated data at any time from Account → Delete account.',
        },
      ],
    },
    {
      heading: 'Changes to this policy',
      blocks: [
        {
          type: 'paragraph',
          text: 'We may update this policy from time to time. The date at the top of this page reflects the most recent update.',
        },
      ],
    },
  ],
  contactEmail: 'dennygan.nz@gmail.com',
};
