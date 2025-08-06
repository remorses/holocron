import * as cookie from 'cookie'
import { Form, href, redirect, useNavigation } from 'react-router'
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
import {
    CONTESTO_DRAFT_MESSAGE_KEY,
    CONTESTO_SUBMIT_ON_LOAD,
} from 'contesto/src/lib/constants'

export async function loader({ request }: Route.LoaderArgs) {
    const { userId, redirectTo } = await getSession({ request })
    if (redirectTo) {
        return {}
    }
    return {}
}

export default function App() {
    const navigation = useNavigation()
    const isLoading = navigation.state !== 'idle'
    return (
        <Form
            action='/login'
            onSubmit={(e) => {
                const form = e.target as HTMLFormElement
                const input = form.elements.namedItem(
                    'prompt',
                ) as HTMLInputElement | null
                if (input && input.value !== undefined) {
                    // Set cookies instead of localStorage
                    const encodedValue = encodeURIComponent(input.value)
                    document.cookie = cookie.serialize(
                        CONTESTO_DRAFT_MESSAGE_KEY,
                        encodedValue,
                        {
                            path: '/',
                            maxAge: 60 * 60 * 24 * 7, // 7 days
                        },
                    )
                    document.cookie = cookie.serialize(
                        CONTESTO_SUBMIT_ON_LOAD,
                        'true',
                        {
                            path: '/',
                            maxAge: 60 * 60, // 1 hour
                        },
                    )
                }
            }}
            className='flex dark bg-black text-white flex-col items-center '
        >
            <NavBarFramerComponent.Responsive className='!fixed z-10' />
            <HeroSectionFramerComponent.Responsive
                promptButtonText={isLoading ? 'loading...' : 'generate website'}
            />
            {/* <IntroSectionFramerComponent.Responsive />
            <BentoSectionFramerComponent.Responsive />

            <BenefitSectionFramerComponent.Responsive />
            <MetricsSectionFramerComponent.Responsive />
            <PricingSectionFramerComponent.Responsive />
            <TestimonialsSectionFramerComponent.Responsive /> */}
            <FaqSectionFramerComponent.Responsive className='min-h-[900px] flex flex-col justify-start' />
            <FooterFramerComponent.Responsive className='!w-full' />
        </Form>
    )
}
