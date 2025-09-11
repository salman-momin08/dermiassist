import Link from "next/link";
import { Logo } from "../logo";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "../ui/button";

export function AppFooter() {
  return (
    <footer className="border-t">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <Logo />
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            © {new Date().getFullYear()} SkinWise. All Rights Reserved.
          </p>
        </div>
        <nav className="flex gap-4 sm:gap-6 text-sm text-muted-foreground">
          <Link href="/project-details" className="hover:text-foreground">Project Details</Link>
          <a href="https://myportfolio-ashen-one-35.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Developer Details</a>

          <Dialog>
            <DialogTrigger asChild>
                <Button variant="link" className="p-0 text-sm text-muted-foreground hover:text-foreground h-auto">Terms & Conditions</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Terms & Conditions</DialogTitle>
                <DialogDescription>
                  Last updated: {new Date().toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-6">
                <div className="space-y-4 text-sm text-muted-foreground">
                  <p>Welcome to SkinWise. These terms and conditions outline the rules and regulations for the use of our application.</p>
                  <h3 className="font-semibold text-foreground">1. Intellectual Property Rights</h3>
                  <p>Other than the content you own, under these Terms, SkinWise and/or its licensors own all the intellectual property rights and materials contained in this application.</p>
                  <h3 className="font-semibold text-foreground">2. Restrictions</h3>
                  <p>You are specifically restricted from all of the following: publishing any application material in any other media; selling, sublicensing and/or otherwise commercializing any application material; publicly performing and/or showing any application material; using this application in any way that is or may be damaging to this application.</p>
                  <h3 className="font-semibold text-foreground">3. No warranties</h3>
                  <p>This application is provided "as is," with all faults, and SkinWise expresses no representations or warranties, of any kind related to this application or the materials contained on this application. Also, nothing contained on this application shall be interpreted as advising you.</p>
                  <h3 className="font-semibold text-foreground">4. Limitation of liability</h3>
                  <p>In no event shall SkinWise, nor any of its officers, directors and employees, shall be held liable for anything arising out of or in any way connected with your use of this application whether such liability is under contract. SkinWise, including its officers, directors and employees shall not be held liable for any indirect, consequential or special liability arising out of or in any way related to your use of this application.</p>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
               <Button variant="link" className="p-0 text-sm text-muted-foreground hover:text-foreground h-auto">Privacy Policy</Button>
            </DialogTrigger>
             <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Privacy Policy</DialogTitle>
                <DialogDescription>
                   Last updated: {new Date().toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-6">
                 <div className="space-y-4 text-sm text-muted-foreground">
                    <p>Your privacy is important to us. It is SkinWise's policy to respect your privacy regarding any information we may collect from you across our application.</p>
                    <h3 className="font-semibold text-foreground">1. Information we collect</h3>
                    <p>We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent. We also let you know why we’re collecting it and how it will be used.</p>
                    <h3 className="font-semibold text-foreground">2. How we use your information</h3>
                    <p>We use the information we collect in various ways, including to: provide, operate, and maintain our application; improve, personalize, and expand our application; understand and analyze how you use our application; develop new products, services, features, and functionality.</p>
                    <h3 className="font-semibold text-foreground">3. Log Data</h3>
                    <p>We want to inform you that whenever you use our Service, in a case of an error in the app we collect data and information (through third-party products) on your phone called Log Data. This Log Data may include information such as your device Internet Protocol (“IP”) address, device name, operating system version, the configuration of the app when utilizing our Service, the time and date of your use of the Service, and other statistics.</p>
                 </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </nav>
      </div>
    </footer>
  );
}