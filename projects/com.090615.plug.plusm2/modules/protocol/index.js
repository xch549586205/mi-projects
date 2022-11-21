import { Host } from 'miot';

function localized() {
  let lang = Host.locale.language;
  switch (lang) {
    default:
      return {
        privacyURL: require('./policy_zh.html'),
        agreementURL: '',
        hideAgreement: false,
        experiencePlanURL: '',
        hideUserExperiencePlan: true
      };
  }
}

export default localized();
