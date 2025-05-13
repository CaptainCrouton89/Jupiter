"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto py-12 px-4 md:px-6 max-w-3xl">
      <header className="mb-12 pb-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-gray-900 dark:text-gray-100">
          Terms of Service for Jupiter Mail
        </h1>
        <p className="text-sm text-muted-foreground">
          Last Updated:{" "}
          {new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </header>

      <article className="prose prose-slate dark:prose-invert max-w-none lg:prose-lg leading-relaxed space-y-6">
        <p>
          Welcome to Jupiter Mail (&quot;we&quot;, &quot;us&quot;,
          &quot;our&quot;, or the &quot;Service&quot;). These Terms of Service
          (&quot;Terms&quot;) govern your use of our email management
          application and related services. By accessing or using Jupiter Mail,
          you agree to be bound by these Terms. If you do not agree to these
          Terms, please do not use our Service.
        </p>

        <h2 id="service-description">1. Description of Service</h2>
        <p>
          Jupiter Mail is an application designed to help you manage your email
          inbox more effectively. Our features include, but are not limited to,
          automated email categorization, rule-based actions on emails (such as
          marking as read, archiving, trashing, or marking as spam), and the
          generation of weekly email digests based on your preferences. The
          Service requires access to your connected email account(s) to perform
          these functions.
        </p>

        <h2 id="user-accounts">2. User Accounts</h2>
        <p>
          To use Jupiter Mail, you may need to connect an existing email account
          (e.g., your Google account). You are responsible for maintaining the
          confidentiality of your account credentials for any third-party
          services you connect to Jupiter Mail. You agree to notify us
          immediately of any unauthorized use of your connected accounts or any
          other breach of security. We are not liable for any loss or damage
          arising from your failure to comply with this section.
        </p>
        <p>
          You must be at least 13 years old (or the age of digital consent in
          your jurisdiction) to use Jupiter Mail.
        </p>

        <h2 id="user-responsibilities">3. User Responsibilities and Conduct</h2>
        <p>
          You agree to use Jupiter Mail only for lawful purposes and in
          accordance with these Terms. You agree not to:
        </p>
        <ul>
          <li>
            Violate any applicable national or international law or regulation.
          </li>
          <li>
            Infringe upon or violate our intellectual property rights or the
            intellectual property rights of others.
          </li>
          <li>
            Transmit any worms, viruses, or any code of a destructive nature.
          </li>
          <li>
            Attempt to gain unauthorized access to, interfere with, damage, or
            disrupt any parts of the Service, the server on which the Service is
            stored, or any server, computer, or database connected to the
            Service.
          </li>
          <li>
            Use the Service in any manner that could disable, overburden,
            damage, or impair the Service or interfere with any other
            party&apos;s use of the Service.
          </li>
          <li>
            Reverse engineer, decompile, disassemble, or otherwise attempt to
            discover the source code of Jupiter Mail.
          </li>
        </ul>

        <h2 id="intellectual-property">4. Intellectual Property Rights</h2>
        <p>
          The Service and its original content (excluding content provided by
          users, such as their email data), features, and functionality are and
          will remain the exclusive property of Jupiter Mail and its licensors.
          The Service is protected by copyright, trademark, and other laws of
          both the United States and foreign countries. Our trademarks and trade
          dress may not be used in connection with any product or service
          without our prior written consent.
        </p>
        <p>
          You retain all ownership rights to your email content. By using
          Jupiter Mail, you grant us a limited, non-exclusive, royalty-free,
          worldwide license to access, use, process, and display your email
          content solely for the purpose of providing and improving the Service
          to you, as configured by your settings and as described in our Privacy
          Policy.
        </p>

        <h2 id="third-party-services">5. Third-Party Services and Links</h2>
        <p>
          Jupiter Mail may integrate with or rely on third-party services (e.g.,
          email providers like Google, AI service providers). Your use of these
          third-party services is governed by their respective terms of service
          and privacy policies. We are not responsible for the practices of any
          third-party services.
        </p>
        <p>
          Our Service may contain links to third-party web sites or services
          that are not owned or controlled by Jupiter Mail. We have no control
          over, and assume no responsibility for, the content, privacy policies,
          or practices of any third-party web sites or services.
        </p>

        <h2 id="disclaimers">6. Disclaimers of Warranties</h2>
        <p>
          THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS
          AVAILABLE&quot; BASIS. JUPITER MAIL MAKES NO WARRANTIES, EXPRESS OR
          IMPLIED, REGARDING THE SERVICE, INCLUDING BUT NOT LIMITED TO
          WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
          NON-INFRINGEMENT, AND ANY WARRANTIES ARISING OUT OF COURSE OF DEALING
          OR USAGE OF TRADE.
        </p>
        <p>
          WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR
          ERROR-FREE, THAT DEFECTS WILL BE CORRECTED, OR THAT THE SERVICE OR THE
          SERVERS THAT MAKE IT AVAILABLE ARE FREE OF VIRUSES OR OTHER HARMFUL
          COMPONENTS.
        </p>

        <h2 id="limitation-of-liability">7. Limitation of Liability</h2>
        <p>
          TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL
          JUPITER MAIL, ITS AFFILIATES, DIRECTORS, EMPLOYEES, OR LICENSORS BE
          LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
          PUNITIVE DAMAGES (INCLUDING, WITHOUT LIMITATION, DAMAGES FOR LOSS OF
          PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES) ARISING OUT
          OF OR RELATING TO YOUR ACCESS TO OR USE OF, OR INABILITY TO ACCESS OR
          USE, THE SERVICE, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING
          NEGLIGENCE), STATUTE, OR ANY OTHER LEGAL THEORY, WHETHER OR NOT WE
          HAVE BEEN INFORMED OF THE POSSIBILITY OF SUCH DAMAGE.
        </p>
        <p>
          OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING
          TO THE SERVICE OR THESE TERMS SHALL NOT EXCEED THE AMOUNT, IF ANY, YOU
          PAID US TO USE THE SERVICE DURING THE TWELVE (12) MONTHS PRIOR TO THE
          CLAIM.
        </p>

        <h2 id="indemnification">8. Indemnification</h2>
        <p>
          You agree to defend, indemnify, and hold harmless Jupiter Mail and its
          licensee and licensors, and their employees, contractors, agents,
          officers, and directors, from and against any and all claims, damages,
          obligations, losses, liabilities, costs or debt, and expenses
          (including but not limited to attorney&apos;s fees), resulting from or
          arising out of a) your use and access of the Service, by you or any
          person using your account and password; or b) a breach of these Terms.
        </p>

        <h2 id="termination">9. Termination</h2>
        <p>
          We may terminate or suspend your access to our Service immediately,
          without prior notice or liability, for any reason whatsoever,
          including without limitation if you breach the Terms.
        </p>
        <p>
          You may terminate your use of the Service at any time by disconnecting
          your email account(s) and ceasing to use the application.
        </p>
        <p>
          Upon termination, your right to use the Service will immediately
          cease. Provisions of these Terms that by their nature should survive
          termination shall survive termination, including, without limitation,
          ownership provisions, warranty disclaimers, indemnity, and limitations
          of liability.
        </p>

        <h2 id="changes-to-terms">10. Changes to Terms</h2>
        <p>
          We reserve the right, at our sole discretion, to modify or replace
          these Terms at any time. If a revision is material, we will provide at
          least 30 days&apos; notice prior to any new terms taking effect. What
          constitutes a material change will be determined at our sole
          discretion.
        </p>
        <p>
          By continuing to access or use our Service after any revisions become
          effective, you agree to be bound by the revised terms. If you do not
          agree to the new terms, you are no longer authorized to use the
          Service.
        </p>

        <h2 id="governing-law">11. Governing Law</h2>
        <p>
          These Terms shall be governed and construed in accordance with the
          laws of the State of California, United States, without regard to its
          conflict of law provisions.
        </p>

        <h2 id="dispute-resolution">12. Dispute Resolution</h2>
        <p>
          Any disputes arising from or relating to these Terms or the Service
          shall be resolved through binding arbitration conducted in California,
          rather than in court, except that you may assert claims in small
          claims court if your claims qualify. The arbitration will be conducted
          by the American Arbitration Association (AAA) under its rules.
        </p>

        <h2 id="miscellaneous">13. Miscellaneous</h2>
        <p>
          Our failure to enforce any right or provision of these Terms will not
          be considered a waiver of those rights. If any provision of these
          Terms is held to be invalid or unenforceable by a court, the remaining
          provisions of these Terms will remain in effect. These Terms
          constitute the entire agreement between us regarding our Service and
          supersede and replace any prior agreements we might have had between
          us regarding the Service.
        </p>

        <h2 id="contact-us">14. Contact Us</h2>
        <p>
          If you have any questions about these Terms, please contact us at
          silas@rhyneerconsulting.com.
        </p>
      </article>

      <div className="mt-16 text-center">
        <Link href="/landing">
          <Button variant="outline" size="lg">
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
