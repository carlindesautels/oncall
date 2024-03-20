import { omit } from 'lodash-es';
import { runInAction, makeAutoObservable } from 'mobx';

import { AlertTemplatesDTO } from 'models/alert_templates/alert_templates';
import { ChannelFilter } from 'models/channel_filter/channel_filter.types';
import { Heartbeat } from 'models/heartbeat/heartbeat.types';
import { ActionKey } from 'models/loader/action-keys';
import { makeRequest } from 'network/network';
import { ApiSchemas } from 'network/oncall-api/api.types';
import { operations } from 'network/oncall-api/autogenerated-api.types';
import { onCallApi } from 'network/oncall-api/http-client';
import { move } from 'state/helpers';
import { RootBaseStore } from 'state/rootBaseStore/RootBaseStore';
import { AutoLoadingState, WithGlobalNotification } from 'utils/decorators';
import { OmitReadonlyMembers } from 'utils/types';

import { AlertReceiveChannelCounters, ContactPoint } from './alert_receive_channel.types';

export class AlertReceiveChannelStore {
  rootStore: RootBaseStore;
  searchResult: Array<ApiSchemas['AlertReceiveChannel']['id']>;
  paginatedSearchResult: {
    count?: number;
    results?: Array<ApiSchemas['AlertReceiveChannel']['id']>;
    page_size?: number;
  } = {};
  items: {
    [id: string]: ApiSchemas['AlertReceiveChannel'];
  } = {};
  counters: { [id: string]: AlertReceiveChannelCounters } = {};
  channelFilterIds: { [id: string]: Array<ChannelFilter['id']> } = {};
  channelFilters: { [id: string]: ChannelFilter } = {};
  alertReceiveChannelToHeartbeat: {
    [id: string]: Heartbeat['id'];
  } = {};
  actions: { [id: string]: Array<ApiSchemas['Webhook']> } = {};
  alertReceiveChannelOptions: Array<ApiSchemas['AlertReceiveChannelIntegrationOptions']> = [];
  templates: { [id: string]: AlertTemplatesDTO[] } = {};
  connectedContactPoints: { [id: string]: ContactPoint[] } = {};
  serviceNowStatusList: Array<[string, string]>;

  constructor(rootStore: RootBaseStore) {
    makeAutoObservable(this, undefined, { autoBind: true });
    this.rootStore = rootStore;
  }

  @WithGlobalNotification({ failure: 'There was an issue creating Integration. Please try again.' })
  async create({
    data,
    skipErrorHandling,
  }: {
    data: OmitReadonlyMembers<ApiSchemas['AlertReceiveChannelCreate']>;
    skipErrorHandling?: boolean;
  }) {
    const result = await onCallApi({ skipErrorHandling }).POST('/alert_receive_channels/', {
      params: {},
      body: data as ApiSchemas['AlertReceiveChannelCreate'],
    });
    await this.rootStore.organizationStore.loadCurrentOrganization();
    return result.data;
  }

  @AutoLoadingState(ActionKey.UPDATE_INTEGRATION)
  @WithGlobalNotification({ failure: 'There was an issue updating Integration. Please try again.' })
  async update({
    id,
    data,
    skipErrorHandling,
  }: {
    id: ApiSchemas['AlertReceiveChannelUpdate']['id'];
    data: OmitReadonlyMembers<ApiSchemas['AlertReceiveChannelUpdate']>;
    skipErrorHandling?: boolean;
  }) {
    const result = await onCallApi({ skipErrorHandling }).PUT('/alert_receive_channels/{id}/', {
      params: { path: { id } },
      body: data as ApiSchemas['AlertReceiveChannelUpdate'],
    });
    await this.rootStore.organizationStore.loadCurrentOrganization();

    runInAction(() => {
      this.items = {
        ...this.items,
        [id]: { ...result.data },
      };
    });
  }

  async fetchItemById(
    id: ApiSchemas['AlertReceiveChannel']['id'],
    skipErrorHandling = false
  ): Promise<ApiSchemas['AlertReceiveChannel']> {
    const alertReceiveChannel = await onCallApi({ skipErrorHandling }).GET('/alert_receive_channels/{id}/', {
      params: { path: { id } },
    });

    runInAction(() => {
      this.items = {
        ...this.items,
        [id]: { ...alertReceiveChannel.data, heartbeat: alertReceiveChannel.data.heartbeat || null },
      };
    });

    this.populateHearbeats([alertReceiveChannel.data]);

    return alertReceiveChannel.data;
  }

  async fetchServiceNowStatusList({
    id,
    skipErrorHandling,
  }: {
    id: ApiSchemas['AlertReceiveChannel']['id'];
    skipErrorHandling?: boolean;
  }): Promise<void> {
    const statusList = await onCallApi({ skipErrorHandling }).GET('/alert_receive_channels/{id}/status_options/', {
      params: { path: { id } },
    });

    runInAction(() => {
      this.serviceNowStatusList = statusList.data;
    });
  }

  async hasServiceNowToken({ id }: { id: ApiSchemas['AlertReceiveChannel']['id'] }) {
    try {
      const response = await onCallApi({ skipErrorHandling: true }).GET('/alert_receive_channels/{id}/api_token/', {
        params: { path: { id } },
      });
      return response?.response.status === 200;
    } catch (ex) {
      return false;
    }
  }

  async testServiceNowAuthentication({ data }: { data: Partial<ApiSchemas['AlertReceiveChannel']> }) {
    try {
      const result = await onCallApi({ skipErrorHandling: false }).POST('/alert_receive_channels/test_connection/', {
        // @ts-ignore
        body: {
          ...data,
        },
      });
      return result?.response.status === 200;
    } catch (ex) {
      return false;
    }
  }

  @WithGlobalNotification({ failure: 'There was an error generating the token. Please try again' })
  async generateServiceNowToken({
    id,
    skipErrorHandling,
  }: {
    id: ApiSchemas['AlertReceiveChannel']['id'];
    skipErrorHandling?: boolean;
  }): Promise<ApiSchemas['IntegrationTokenPostResponse']> {
    const result = await onCallApi({ skipErrorHandling }).POST('/alert_receive_channels/{id}/api_token/', {
      params: { path: { id } },
    });

    return result.data;
  }

  async fetchItems(query: any = '') {
    const {
      data: { results },
    } = await onCallApi().GET('/alert_receive_channels/', {
      params: { query: typeof query === 'string' ? { search: query } : query },
    });

    runInAction(() => {
      this.items = {
        ...this.items,
        ...results.reduce(
          (acc: { [key: number]: ApiSchemas['AlertReceiveChannel'] }, item: ApiSchemas['AlertReceiveChannel']) => ({
            ...acc,
            [item.id]: omit(item, 'heartbeat'),
          }),
          {}
        ),
      };
    });

    this.populateHearbeats(results);

    runInAction(() => {
      this.searchResult = results.map((item: ApiSchemas['AlertReceiveChannel']) => item.id);
    });

    this.fetchCounters();

    return results;
  }

  @AutoLoadingState(ActionKey.FETCH_INTEGRATIONS)
  async fetchPaginatedItems({
    filters,
    page = 1,
    shouldFetchCounters = false,
    invalidateFn = undefined,
    perpage,
  }: {
    filters: operations['alert_receive_channels_list']['parameters']['query'];
    page?: number;
    shouldFetchCounters?: boolean;
    invalidateFn?: () => boolean;
    perpage?: number;
  }) {
    const {
      data: { count, results, page_size },
    } = await onCallApi().GET('/alert_receive_channels/', { params: { query: { ...filters, page, perpage } } });

    if (invalidateFn?.()) {
      return undefined;
    }

    runInAction(() => {
      this.items = {
        ...this.items,
        ...results.reduce(
          (acc: { [key: number]: ApiSchemas['AlertReceiveChannel'] }, item: ApiSchemas['AlertReceiveChannel']) => ({
            ...acc,
            [item.id]: omit(item, 'heartbeat'),
          }),
          {}
        ),
      };
    });

    this.populateHearbeats(results);

    runInAction(() => {
      this.paginatedSearchResult = {
        count,
        results: results.map((item: ApiSchemas['AlertReceiveChannel']) => item.id),
        page_size,
      };
    });

    if (shouldFetchCounters) {
      this.fetchCounters();
    }

    return results;
  }

  resetPaginatedResults() {
    this.paginatedSearchResult = {};
  }

  populateHearbeats(alertReceiveChannels: Array<ApiSchemas['AlertReceiveChannelPolymorphic']>) {
    const heartbeats = alertReceiveChannels.reduce(
      (acc: any, alertReceiveChannel: ApiSchemas['AlertReceiveChannel']) => {
        if (alertReceiveChannel.heartbeat) {
          acc[alertReceiveChannel.heartbeat.id] = alertReceiveChannel.heartbeat;
        }

        return acc;
      },
      {}
    );

    runInAction(() => {
      this.rootStore.heartbeatStore.items = {
        ...this.rootStore.heartbeatStore.items,
        ...heartbeats,
      };
    });

    const alertReceiveChannelToHeartbeat = alertReceiveChannels.reduce(
      (acc: any, alertReceiveChannel: ApiSchemas['AlertReceiveChannel']) => {
        if (alertReceiveChannel.heartbeat) {
          acc[alertReceiveChannel.id] = alertReceiveChannel.heartbeat.id;
        }

        return acc;
      },
      {}
    );

    runInAction(() => {
      this.alertReceiveChannelToHeartbeat = {
        ...this.alertReceiveChannelToHeartbeat,
        ...alertReceiveChannelToHeartbeat,
      };
    });
  }

  async fetchChannelFilters(alertReceiveChannelId: ApiSchemas['AlertReceiveChannel']['id'], isOverwrite = false) {
    const response = await makeRequest(`/channel_filters/`, {
      params: { alert_receive_channel: alertReceiveChannelId },
    });

    const channelFilters = response.reduce(
      (acc: any, channelFilter: ChannelFilter) => ({
        ...acc,
        [channelFilter.id]: channelFilter,
      }),
      {}
    );

    runInAction(() => {
      this.channelFilters = {
        ...this.channelFilters,
        ...channelFilters,
      };
    });

    if (isOverwrite) {
      runInAction(() => {
        // This is needed because on Move Up/Down/Removal the store no longer reflects the correct state
        this.channelFilters = {
          ...channelFilters,
        };
      });
    }

    runInAction(() => {
      this.channelFilterIds = {
        ...this.channelFilterIds,
        [alertReceiveChannelId]: response.map((channelFilter: ChannelFilter) => channelFilter.id),
      };
    });
  }

  async saveChannelFilter(channelFilterId: ChannelFilter['id'], data: Partial<ChannelFilter>) {
    const response = await makeRequest(`/channel_filters/${channelFilterId}/`, {
      method: 'PUT',
      data,
    });

    runInAction(() => {
      this.channelFilters = {
        ...this.channelFilters,
        [response.id]: response,
      };
    });

    return response;
  }

  async moveChannelFilterToPosition(
    alertReceiveChannelId: ApiSchemas['AlertReceiveChannel']['id'],
    oldIndex: number,
    newIndex: number
  ) {
    const channelFilterId = this.channelFilterIds[alertReceiveChannelId][oldIndex];

    this.channelFilterIds[alertReceiveChannelId] = move(
      this.channelFilterIds[alertReceiveChannelId],
      oldIndex,
      newIndex
    );

    await makeRequest(`/channel_filters/${channelFilterId}/move_to_position/?position=${newIndex}`, { method: 'PUT' });

    this.fetchChannelFilters(alertReceiveChannelId, true);
  }

  async deleteChannelFilter(channelFilterId: ChannelFilter['id']) {
    const channelFilter = this.channelFilters[channelFilterId];

    this.channelFilterIds[channelFilter.alert_receive_channel].splice(
      this.channelFilterIds[channelFilter.alert_receive_channel].indexOf(channelFilterId),
      1
    );

    await makeRequest(`/channel_filters/${channelFilterId}`, {
      method: 'DELETE',
    });

    return this.fetchChannelFilters(channelFilter.alert_receive_channel, true);
  }

  async fetchAlertReceiveChannelOptions() {
    const { data } = await onCallApi().GET(`/alert_receive_channels/integration_options/`, undefined);

    runInAction(() => {
      this.alertReceiveChannelOptions = data;
    });
  }

  @WithGlobalNotification({ success: 'Integration has been saved', failure: 'Failed to save integration' })
  async saveAlertReceiveChannel(
    id: ApiSchemas['AlertReceiveChannel']['id'],
    payload: OmitReadonlyMembers<ApiSchemas['AlertReceiveChannelUpdate']>
  ) {
    const currentIntegration = this.items[id];
    const { data } = await onCallApi().PUT('/alert_receive_channels/{id}/', {
      params: { path: { id } },
      body: {
        description_short: currentIntegration.description_short,
        verbal_name: currentIntegration.verbal_name,
        allow_source_based_resolving: currentIntegration.allow_source_based_resolving,
        alert_group_labels: currentIntegration.alert_group_labels,
        ...payload,
      } as ApiSchemas['AlertReceiveChannelUpdate'],
    });

    runInAction(() => {
      this.items = {
        ...this.items,
        [id]: data,
      };
    });
  }

  async fetchTemplates(
    alertReceiveChannelId: ApiSchemas['AlertReceiveChannel']['id'],
    alertGroupId?: ApiSchemas['AlertGroup']['pk']
  ) {
    const response = await makeRequest(`/alert_receive_channel_templates/${alertReceiveChannelId}/`, {
      params: { alert_group_id: alertGroupId },
      withCredentials: true,
    });

    runInAction(() => {
      this.templates = {
        ...this.templates,
        [alertReceiveChannelId]: response,
      };
    });
  }

  async saveTemplates(
    alertReceiveChannelId: ApiSchemas['AlertReceiveChannel']['id'],
    data: Partial<AlertTemplatesDTO>
  ) {
    const response = await makeRequest(`/alert_receive_channel_templates/${alertReceiveChannelId}/`, {
      method: 'PUT',
      data,
      withCredentials: true,
    });

    runInAction(() => {
      this.templates = {
        ...this.templates,
        [alertReceiveChannelId]: response,
      };
    });
  }

  async fetchConnectedContactPoints(alertReceiveChannelId: ApiSchemas['AlertReceiveChannel']['id']) {
    const { data } = await onCallApi().GET('/alert_receive_channels/{id}/connected_contact_points/', {
      params: { path: { id: alertReceiveChannelId } },
    });

    runInAction(() => {
      this.connectedContactPoints = {
        ...this.connectedContactPoints,

        [alertReceiveChannelId]: data.reduce((list: ContactPoint[], payload) => {
          payload.contact_points.forEach((contactPoint) => {
            list.push({
              dataSourceName: payload.name,
              dataSourceId: payload.uid,
              contactPoint: contactPoint.name,
              notificationConnected: contactPoint.notification_connected,
            });
          });

          return list;
        }, []),
      };
    });
  }

  async fetchCounters() {
    const { data } = await onCallApi().GET('/alert_receive_channels/counters/', undefined);
    runInAction(() => {
      this.counters = data;
    });
  }

  async fetchCountersForIntegration(id: ApiSchemas['AlertReceiveChannel']['id']) {
    const { data } = await onCallApi().GET('/alert_receive_channels/{id}/counters/', { params: { path: { id } } });

    runInAction(() => {
      this.counters = {
        ...this.counters,
        [id]: {
          ...data[id],
        },
      };
    });

    return data;
  }
}
