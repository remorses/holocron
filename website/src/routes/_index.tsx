import { href, redirect } from 'react-router'
import 'website/src/framer/styles.css'

import { Route } from '../+types/root'
import { getSession } from '../lib/better-auth'
import { prisma } from 'db'
import HeroSectionFramerComponent from 'website/src/framer/hero-section'
import IntroSectionFramerComponent from 'website/src/framer/intro-section'
import BentoSectionFramerComponent from 'website/src/framer/bento-section'
// import FeatureSectionFramerComponent from 'website/src/framer/feature-section'
import BenefitSectionFramerComponent from 'website/src/framer/benefit-section'
import MetricsSectionFramerComponent from 'website/src/framer/metrics-section'
import PricingSectionFramerComponent from 'website/src/framer/pricing-section'
import TestimonialsSectionFramerComponent from 'website/src/framer/testimonials-section'
import FaqSectionFramerComponent from 'website/src/framer/faq-section'
import React, { Suspense } from 'react'
import NavBarFramerComponent from '../framer/nav-bar'
import FooterFramerComponent from '../framer/footer'

export async function loader({ request }: Route.LoaderArgs) {
    const { userId, redirectTo } = await getSession({ request })
    if (redirectTo) {
        return {}
    }
    return {}

}

export default function App() {
    return (
        <div className='flex flex-col items-center gap-3 '>
            <NavBarFramerComponent.Responsive />
            <HeroSectionFramerComponent.Responsive />
            <IntroSectionFramerComponent.Responsive />
            <BentoSectionFramerComponent.Responsive />
            {/* <FeatureSectionFramerComponent.Responsive /> */}
            <BenefitSectionFramerComponent.Responsive />
            <MetricsSectionFramerComponent.Responsive />
            <PricingSectionFramerComponent.Responsive />
            <TestimonialsSectionFramerComponent.Responsive />
            <FaqSectionFramerComponent.Responsive />
            <FooterFramerComponent.Responsive />
        </div>
    )
}
