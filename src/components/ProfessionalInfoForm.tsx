
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, GraduationCap, Award, Link as LinkIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export interface EducationEntry {
    degree: string;
    institution: string;
    year: string;
    field?: string;
}

export interface CertificateEntry {
    name: string;
    issuer: string;
    year: string;
    url?: string;
}

interface ProfessionalInfoFormProps {
    yearsOfExperience?: number;
    languages?: string[];
    consultationFee?: string;
    education?: EducationEntry[];
    certificates?: CertificateEntry[];
    onYearsOfExperienceChange: (years: number) => void;
    onLanguagesChange: (languages: string[]) => void;
    onConsultationFeeChange: (fee: string) => void;
    onEducationChange: (education: EducationEntry[]) => void;
    onCertificatesChange: (certificates: CertificateEntry[]) => void;
}

export function ProfessionalInfoForm({
    yearsOfExperience,
    languages,
    consultationFee,
    education = [],
    certificates = [],
    onYearsOfExperienceChange,
    onLanguagesChange,
    onConsultationFeeChange,
    onEducationChange,
    onCertificatesChange,
}: ProfessionalInfoFormProps) {
    const [languageInput, setLanguageInput] = useState('');

    // Education local state for new entry
    const [newEdu, setNewEdu] = useState<EducationEntry>({ degree: '', institution: '', year: '', field: '' });
    // Certificates local state for new entry
    const [newCert, setNewCert] = useState<CertificateEntry>({ name: '', issuer: '', year: '', url: '' });

    // Language handlers
    const addLanguage = () => {
        if (languageInput.trim() && !languages?.includes(languageInput.trim())) {
            onLanguagesChange([...(languages || []), languageInput.trim()]);
            setLanguageInput('');
        }
    };

    const removeLanguage = (lang: string) => {
        onLanguagesChange((languages || []).filter(l => l !== lang));
    };

    // Education handlers
    const addEducation = () => {
        if (newEdu.degree && newEdu.institution && newEdu.year) {
            onEducationChange([...education, newEdu]);
            setNewEdu({ degree: '', institution: '', year: '', field: '' });
        }
    };

    const removeEducation = (index: number) => {
        onEducationChange(education.filter((_, i) => i !== index));
    };

    // Certificate handlers
    const addCertificate = () => {
        if (newCert.name && newCert.issuer && newCert.year) {
            onCertificatesChange([...certificates, newCert]);
            setNewCert({ name: '', issuer: '', year: '', url: '' });
        }
    };

    const removeCertificate = (index: number) => {
        onCertificatesChange(certificates.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-6">
            {/* Basic Professional Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Professional Details</CardTitle>
                    <CardDescription>Additional information about your practice</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="years-exp">Years of Experience</Label>
                            <Input
                                id="years-exp"
                                type="number"
                                min="0"
                                value={yearsOfExperience || ''}
                                onChange={(e) => onYearsOfExperienceChange(parseInt(e.target.value) || 0)}
                                placeholder="e.g., 10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="consultation-fee">Consultation Fee</Label>
                            <Input
                                id="consultation-fee"
                                value={consultationFee || ''}
                                onChange={(e) => onConsultationFeeChange(e.target.value)}
                                placeholder="e.g., $100 or Free"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="languages">Languages Spoken</Label>
                        <div className="flex gap-2">
                            <Input
                                id="languages"
                                value={languageInput}
                                onChange={(e) => setLanguageInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
                                placeholder="e.g., English, Spanish"
                            />
                            <Button type="button" onClick={addLanguage} variant="outline">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {languages?.map((lang, idx) => (
                                <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                                    {lang}
                                    <button onClick={() => removeLanguage(lang)} className="ml-1 hover:text-destructive">
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Education Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5" />
                        Education
                    </CardTitle>
                    <CardDescription>Academic qualifications and medical degrees</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* List existing education */}
                    <div className="space-y-3">
                        {education.map((edu, idx) => (
                            <div key={idx} className="flex items-start justify-between p-3 border rounded-lg bg-muted/30">
                                <div>
                                    <p className="font-semibold">{edu.degree}</p>
                                    <p className="text-sm text-muted-foreground">{edu.institution} ({edu.year})</p>
                                    {edu.field && <p className="text-xs text-muted-foreground">Field: {edu.field}</p>}
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => removeEducation(idx)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <Separator />

                    {/* Add new education */}
                    <div className="space-y-4">
                        <p className="text-sm font-medium">Add New Qualification</p>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Degree</Label>
                                <Input
                                    placeholder="e.g. MBBS, MD"
                                    value={newEdu.degree}
                                    onChange={(e) => setNewEdu({ ...newEdu, degree: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Institution</Label>
                                <Input
                                    placeholder="e.g. AIIMS"
                                    value={newEdu.institution}
                                    onChange={(e) => setNewEdu({ ...newEdu, institution: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Year</Label>
                                <Input
                                    placeholder="e.g. 2015"
                                    value={newEdu.year}
                                    onChange={(e) => setNewEdu({ ...newEdu, year: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Field (Optional)</Label>
                                <Input
                                    placeholder="e.g. Dermatology"
                                    value={newEdu.field}
                                    onChange={(e) => setNewEdu({ ...newEdu, field: e.target.value })}
                                />
                            </div>
                        </div>
                        <Button onClick={addEducation} variant="default" className="w-full">
                            <Plus className="h-4 w-4 mr-2" /> Add Education
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Certificates Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Award className="h-5 w-5" />
                        Certificates
                    </CardTitle>
                    <CardDescription>Professional certifications and awards</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* List existing certificates */}
                    <div className="space-y-3">
                        {certificates.map((cert, idx) => (
                            <div key={idx} className="flex items-start justify-between p-3 border rounded-lg bg-muted/30">
                                <div>
                                    <p className="font-semibold">{cert.name}</p>
                                    <p className="text-sm text-muted-foreground">{cert.issuer} ({cert.year})</p>
                                    {cert.url && (
                                        <a href={cert.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 mt-1">
                                            <LinkIcon className="h-3 w-3" /> View Document
                                        </a>
                                    )}
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => removeCertificate(idx)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <Separator />

                    {/* Add new certificate */}
                    <div className="space-y-4">
                        <p className="text-sm font-medium">Add New Certificate</p>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Certificate Name</Label>
                                <Input
                                    placeholder="e.g. Board Certified Dermatologist"
                                    value={newCert.name}
                                    onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Issuer</Label>
                                <Input
                                    placeholder="e.g. American Board of Dermatology"
                                    value={newCert.issuer}
                                    onChange={(e) => setNewCert({ ...newCert, issuer: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Year</Label>
                                <Input
                                    placeholder="e.g. 2018"
                                    value={newCert.year}
                                    onChange={(e) => setNewCert({ ...newCert, year: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Document URL (Optional)</Label>
                                <Input
                                    placeholder="https://..."
                                    value={newCert.url}
                                    onChange={(e) => setNewCert({ ...newCert, url: e.target.value })}
                                />
                            </div>
                        </div>
                        <Button onClick={addCertificate} variant="default" className="w-full">
                            <Plus className="h-4 w-4 mr-2" /> Add Certificate
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
