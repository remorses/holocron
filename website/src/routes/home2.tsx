// @ts-nocheck
import { href, redirect } from 'react-router'
import 'website/src/framer-orin/styles.css'

import { Route } from '../+types/root'
import { getSession } from '../lib/better-auth'
import { prisma } from 'db'
import HeroSectionFramerComponent from 'website/src/framer-orin/section-hero'
import SectionBenefitsFramerComponent from 'website/src/framer-orin/section-benefits'
import SectionFeaturesFramerComponent from 'website/src/framer-orin/section-features'
import SectionSocialProofFramerComponent from 'website/src/framer-orin/section-social-proof'
import SectionTestimonialsFramerComponent from 'website/src/framer-orin/section-testimonails'
import SectionProcessFramerComponent from 'website/src/framer-orin/section-process'
import SectionFAQsFramerComponent from 'website/src/framer-orin/section-fa-qs'
import SectionCTAFramerComponent from 'website/src/framer-orin/section-cta'
import FooterFramerComponent from 'website/src/framer-orin/footer'

export async function loader({ request }: Route.LoaderArgs) {
  const { userId, redirectTo } = await getSession({ request })
  if (redirectTo) {
    return {}
  }
  return {}
}

export default function App() {
  return (
    <div className='flex flex-col bg-black dark items-center gap-3'>
      <HeroSectionFramerComponent className='' />
      <HeroSectionFramerComponent.Responsive />
      <SectionBenefitsFramerComponent.Responsive />
      <SectionFeaturesFramerComponent.Responsive />
      <SectionSocialProofFramerComponent.Responsive />
      <SectionTestimonialsFramerComponent.Responsive />
      <SectionProcessFramerComponent.Responsive />
      <SectionFAQsFramerComponent.Responsive />
      <SectionCTAFramerComponent.Responsive />
      <FooterFramerComponent.Responsive />
    </div>
  )
}
