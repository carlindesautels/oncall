import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Drawer, HorizontalGroup, Icon, LoadingPlaceholder, VerticalGroup, useStyles2 } from '@grafana/ui';
import { FormProvider, useForm } from 'react-hook-form';

import { IntegrationInputField } from 'components/IntegrationInputField/IntegrationInputField';
import { Text } from 'components/Text/Text';
import { ApiSchemas } from 'network/oncall-api/api.types';
import { useStore } from 'state/useStore';

import { getCommonServiceNowConfigStyles } from './ServiceNow.styles';
import { ServiceNowStatusSection, ServiceNowStatusMapping } from './ServiceNowStatusSection';

interface CompleteServiceNowConfigDrawerProps {
  onHide: () => void;
}

interface FormFields {
  additional_settings: ApiSchemas['AlertReceiveChannel']['additional_settings'];
}

export const CompleteServiceNowConfigDrawer: React.FC<CompleteServiceNowConfigDrawerProps> = ({ onHide }) => {
  const formMethods = useForm<FormFields>();
  const { handleSubmit } = formMethods;
  const { alertReceiveChannelStore } = useStore();
  const [statusMapping, setStatusMapping] = useState<ServiceNowStatusMapping>({});

  const styles = useStyles2(getStyles);
  const serviceNowAPIToken = ''; // TODO
  const onTokenRegenerate = () => {}; // TODO

  const isLoading = false; // TODO

  return (
    <Drawer title="Complete ServiceNow configuration" onClose={onHide} closeOnMaskClick={false} size="md">
      <FormProvider {...formMethods}>
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <div className={styles.border}>
            <ServiceNowStatusSection statusMapping={statusMapping} setStatusMapping={setStatusMapping} />
          </div>

          <div className={styles.border}>
            <VerticalGroup>
              <HorizontalGroup spacing="xs" align="center">
                <Text type="primary" size="small">
                  ServiceNow API Token
                </Text>
                <Icon name="info-circle" />
              </HorizontalGroup>

              <Text>
                Description for such object and{' '}
                <a href={'#'} target="_blank" rel="noreferrer">
                  <Text type="link">link to documentation</Text>
                </a>
              </Text>

              <div className={styles.tokenContainer}>
                <IntegrationInputField
                  inputClassName={styles.tokenInput}
                  iconsClassName={styles.tokenIcons}
                  value={serviceNowAPIToken}
                  showExternal={false}
                  showEye={false}
                />
                <Button variant="secondary" onClick={onTokenRegenerate}>
                  {serviceNowAPIToken ? 'Regenerate' : 'Generate'}
                </Button>
              </div>
            </VerticalGroup>
          </div>

          <div>
            <HorizontalGroup justify="flex-end">
              <Button variant="secondary" onClick={onHide}>
                Close
              </Button>
              <Button variant="primary" type="submit" disabled={isLoading}>
                {isLoading ? <LoadingPlaceholder className={styles.loader} text="Loading..." /> : 'Proceed'}
              </Button>
            </HorizontalGroup>
          </div>
        </form>
      </FormProvider>
    </Drawer>
  );

  function onFormSubmit(data: FormFields) {
    // alertReceiveChannelStore.update({ id, data, skipErrorHandling: false })
  }
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    ...getCommonServiceNowConfigStyles(theme),
  };
};
