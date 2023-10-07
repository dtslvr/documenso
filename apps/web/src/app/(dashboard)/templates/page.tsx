'use client';

import React, { useState } from 'react';

import { base64 } from '@documenso/lib/universal/base64';
import { putFile } from '@documenso/lib/universal/upload/put-file';
import { Field, Prisma, Recipient } from '@documenso/prisma/client';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { DocumentDropzone } from '@documenso/ui/primitives/document-dropzone';
import { AddFieldsFormPartial } from '@documenso/ui/primitives/document-flow/add-fields';
import { TAddFieldsFormSchema } from '@documenso/ui/primitives/document-flow/add-fields.types';
import { AddTemplateDetailsFormPartial } from '@documenso/ui/primitives/document-flow/add-template-details';
import { TAddTemplateDetailsFormSchema } from '@documenso/ui/primitives/document-flow/add-template-details.types';
import {
  DocumentFlowFormContainer,
  DocumentFlowFormContainerHeader,
} from '@documenso/ui/primitives/document-flow/document-flow-root';
import { DocumentFlowStep } from '@documenso/ui/primitives/document-flow/types';
import { LazyPDFViewer } from '@documenso/ui/primitives/lazy-pdf-viewer';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { createTemplate } from './create-template.action';

type TemplateModeStep = 'fields' | 'details';

export default function TemplatePage() {
  const [uploadedFile, setUploadedFile] = useState<{ file: File; fileBase64: string } | null>();
  const [step, setStep] = useState<TemplateModeStep>('fields');
  const [fields, setFields] = useState<Field[]>([]);

  const { toast } = useToast();

  const documentFlow: Record<TemplateModeStep, DocumentFlowStep> = {
    fields: {
      title: 'Add fields',
      description: 'Upload a document and add fields.',
      stepIndex: 1,
      onBackStep: uploadedFile
        ? () => {
            setUploadedFile(null);
            setFields([]);
          }
        : undefined,
      onNextStep: () => setStep('details'),
    },
    details: {
      title: 'Add details',
      description: 'Enter your template details.',
      stepIndex: 2,
      onBackStep: () => setStep('fields'),
    },
  };

  const currentDocumentFlow = documentFlow[step];

  const onFileDrop = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64String = base64.encode(new Uint8Array(arrayBuffer));

      setUploadedFile({
        file,
        fileBase64: `data:application/pdf;base64,${base64String}`,
      });
    } catch {
      toast({
        title: 'Something went wrong',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  const onFieldsSubmit = (data: TAddFieldsFormSchema) => {
    if (!uploadedFile) {
      return;
    }

    setFields(
      data.fields.map((field, i) => ({
        id: i,
        documentId: -1,
        recipientId: -1,
        type: field.type,
        page: field.pageNumber,
        positionX: new Prisma.Decimal(field.pageX),
        positionY: new Prisma.Decimal(field.pageY),
        width: new Prisma.Decimal(field.pageWidth),
        height: new Prisma.Decimal(field.pageHeight),
        customText: '',
        inserted: false,
      })),
    );

    documentFlow.fields.onNextStep?.();
  };

  const onAddSubjectFormSubmit = async (data: TAddTemplateDetailsFormSchema) => {
    if (!uploadedFile) {
      return;
    }

    const { description, title } = data.template;

    try {
      const putFileData = await putFile(uploadedFile.file);

      await createTemplate({
        documentName: uploadedFile.file.name,
        templateData: {
          type: putFileData.type,
          data: putFileData.data,
        },
        fields: fields.map((field) => ({
          page: field.page,
          type: field.type,
          positionX: field.positionX.toNumber(),
          positionY: field.positionY.toNumber(),
          width: field.width.toNumber(),
          height: field.height.toNumber(),
        })),
        templateDetails: {
          title,
          description,
        },
      });

      toast({
        title: 'Template saved',
        description: 'Your template has been saved successfully.',
        duration: 5000,
      });
    } catch (err) {
      console.error(err);

      toast({
        title: 'Error',
        description: 'An error occurred while sending the document.',
        variant: 'destructive',
      });
    }
  };

  const placeholderRecipient: Recipient = {
    id: -1,
    documentId: -1,
    email: '',
    name: '',
    token: '',
    expired: null,
    signedAt: null,
    readStatus: 'OPENED',
    signingStatus: 'NOT_SIGNED',
    sendStatus: 'NOT_SENT',
  };

  return (
    <div className=" mx-auto grid w-full max-w-screen-xl grid-cols-12 gap-4 px-4 md:px-8">
      <div className="col-span-12 rounded-xl before:rounded-xl lg:col-span-6 xl:col-span-7">
        {uploadedFile ? (
          <Card gradient>
            <CardContent className="p-2">
              <LazyPDFViewer document={uploadedFile.fileBase64} />
            </CardContent>
          </Card>
        ) : (
          <DocumentDropzone className="h-[80vh] max-h-[60rem]" onDrop={onFileDrop} />
        )}
      </div>

      <div className="col-span-12 lg:col-span-6 xl:col-span-5">
        <DocumentFlowFormContainer className="top-24" onSubmit={(e) => e.preventDefault()}>
          <DocumentFlowFormContainerHeader
            title={currentDocumentFlow.title}
            description={currentDocumentFlow.description}
          />

          {step === 'fields' && (
            <fieldset disabled={!uploadedFile} className="flex h-full flex-col">
              <AddFieldsFormPartial
                documentFlow={documentFlow.fields}
                hideRecipients={true}
                recipients={uploadedFile ? [placeholderRecipient] : []}
                numberOfSteps={Object.keys(documentFlow).length}
                fields={fields}
                onSubmit={onFieldsSubmit}
              />
            </fieldset>
          )}

          {step === 'details' && (
            <AddTemplateDetailsFormPartial
              documentFlow={documentFlow.details}
              fields={fields}
              numberOfSteps={Object.keys(documentFlow).length}
              onSubmit={onAddSubjectFormSubmit}
            />
          )}
        </DocumentFlowFormContainer>
      </div>
    </div>
  );
}
