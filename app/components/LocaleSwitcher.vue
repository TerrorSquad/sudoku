<script setup lang="ts">
const { locale, locales, setLocale, t } = useI18n();

const items = computed(() =>
  locales.value.map((l) => ({ label: l.name ?? l.code, value: l.code })),
);

// The visible language name is part of the accessible name, so voice control can target it by what it shows.
const label = computed(
  () => `${t("a11y.switchLanguage")}: ${items.value.find((i) => i.value === locale.value)?.label}`,
);

const selected = computed({
  get: () => locale.value,
  set: (val) => setLocale(val),
});
</script>

<template>
  <USelectMenu
    v-model="selected"
    :items="items"
    value-key="value"
    :aria-label="label"
    class="w-28"
  />
</template>
